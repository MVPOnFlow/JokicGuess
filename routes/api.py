"""Flask API routes for JokicGuess application."""

import math
import datetime
import statistics
import time
import os
import requests as http_requests
from flask import jsonify, send_from_directory, request, g
from concurrent.futures import ThreadPoolExecutor, as_completed
from utils.helpers import (
    prepare_query, map_wallet_to_username, 
    get_rank_and_lineup_for_user, get_flow_wallet_from_ts_username,
    get_ts_username_from_flow_wallet, get_jokic_editions,
    get_dapper_id_from_flow_wallet
)
from config import (
    SWAPFEST_START_TIME, SWAPFEST_END_TIME,
    SWAPFEST_BOOST1_CUTOFF, SWAPFEST_BOOST2_CUTOFF,
    TREASURY_DATA, FLOW_ACCOUNT,
    FLOW_SWAP_ACCOUNT, FLOW_SWAP_PRIVATE_KEY, FLOW_SWAP_KEY_INDEX,
    HORSE_NAMES, REWARD_POOL
)


def register_routes(app):
    """Register all Flask routes."""

    # ── One-time DB migrations (run on first request) ─────────────
    _migrations_done = [False]

    @app.before_request
    def _run_migrations():
        if _migrations_done[0]:
            return
        _migrations_done[0] = True
        try:
            db = get_db()
            cur = db.cursor()
            try:
                cur.execute(prepare_query(
                    "ALTER TABLE completed_swaps ADD COLUMN points INTEGER NOT NULL DEFAULT 0"
                ))
                db.commit()
                print("\u2705 Migration: added points column to completed_swaps")
            except Exception:
                pass  # column already exists
        except Exception:
            pass  # table may not exist yet

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_react(path):
        if path != "" and os.path.exists(f"react-build/{path}"):
            return send_from_directory('react-build', path)
        else:
            return send_from_directory('react-build', 'index.html')

    @app.route("/api/leaderboard")
    def api_leaderboard():
        # Define event period in UTC
        start_time = SWAPFEST_START_TIME
        end_time = SWAPFEST_END_TIME

        # Multiplier cutoffs (UTC)
        boost1_cutoff = SWAPFEST_BOOST1_CUTOFF
        boost2_cutoff = SWAPFEST_BOOST2_CUTOFF

        db = get_db()
        cursor = db.cursor()

        query = prepare_query('''
            SELECT
                from_address,
                SUM(points * CASE
                    WHEN "timestamp" < ? THEN 1.4
                    WHEN "timestamp" < ? THEN 1.2
                    ELSE 1.0
                END) AS total_points,
                MAX("timestamp") AS last_scored_at
            FROM gifts
            WHERE "timestamp" BETWEEN ? AND ?
            GROUP BY from_address
            ORDER BY total_points DESC, last_scored_at ASC
        ''')

        cursor.execute(query, (boost1_cutoff, boost2_cutoff, start_time, end_time))
        rows = cursor.fetchall()

        def _to_iso(ts):
            try:
                return ts.isoformat(sep=' ')
            except AttributeError:
                return str(ts) if ts is not None else None

        # Resolve TopShot usernames in parallel (parent wallet → dapper → username)
        addrs = [r[0] for r in rows]
        username_map = {}
        if addrs:
            def _lookup(addr):
                try:
                    return addr, get_ts_username_from_flow_wallet(addr)
                except Exception:
                    return addr, None
            with ThreadPoolExecutor(max_workers=min(len(addrs), 10)) as pool:
                for addr, uname in pool.map(lambda a: _lookup(a), addrs):
                    if uname:
                        username_map[addr] = uname

        # Map wallets to usernames + attach last_scored_at
        leaderboard_data = [
            {
                "username": username_map.get(from_address, from_address),
                "points": total_points,
                "last_scored_at": _to_iso(last_scored_at),
            }
            for (from_address, total_points, last_scored_at) in rows
        ]

        # Total prize pool
        prize_pool = sum(float(entry["points"]) for entry in leaderboard_data)

        # Prize percentage mapping by rank
        prize_percentages = {1: 25, 2: 20, 3: 15, 4: 11, 5: 8, 6: 6, 7: 5, 8: 4, 9: 3, 10: 2}

        # Add prize info
        for index, entry in enumerate(leaderboard_data, start=1):
            if index in prize_percentages:
                percent = prize_percentages[index]
                pet_count = math.ceil(prize_pool * (percent / 100))
                entry["prize"] = f"{int(entry['points'])} sweepstake entries + Pet your horse {pet_count} times"
            else:
                entry["prize"] = f"{int(entry['points'])} sweepstake entries"

        return jsonify({
            "prize_pool": prize_pool,
            "leaderboard": leaderboard_data
        })

    @app.route('/api/treasury')
    def api_treasury():
        # Get data from config
        treasury_data = TREASURY_DATA.copy()

        # Calculating backed supply
        backed_supply = (
            treasury_data["common_count"] * 2
            + treasury_data["rare_count"] * 100
            + treasury_data["tsd_count"] * 500
            + treasury_data["lego_count"] * 2000
        )

        surplus = backed_supply - treasury_data["tokens_in_wild"]

        treasury_data["backed_supply"] = backed_supply
        treasury_data["surplus"] = surplus
        
        return jsonify(treasury_data)

    @app.route("/api/rewards")
    def api_rewards():
        """Return the reward pool configuration."""
        total_items = sum(r["quantity"] for r in REWARD_POOL)

        return jsonify({
            "reward_pool": REWARD_POOL,
            "total_items": total_items,
        })

    @app.route("/api/fastbreak/contests", methods=["GET"])
    def api_list_fastbreak_contests():
        db = get_db()
        cursor = db.cursor()
        
        cursor.execute(prepare_query('''
            SELECT id, fastbreak_id, lock_timestamp, buy_in_currency, buy_in_amount, status, created_at, display_name
            FROM fastbreakContests
            ORDER BY lock_timestamp ASC
        '''))
        rows = cursor.fetchall()

        now_ts = int(datetime.datetime.now(datetime.UTC).timestamp())
        twenty_four_hours_ago = now_ts - 86400

        recent_started = []
        open_contests = []
        older_started = []

        for row in rows:
            contest_status = row[5]

            # Reclassify OPEN contests as STARTED if lock time has passed
            try:
                lock_ts = int(row[2])
                if contest_status == 'OPEN' and lock_ts < now_ts:
                    contest_status = 'STARTED'
            except:
                pass

            if contest_status == 'CLOSED':
                continue

            contest_data = {
                "id": row[0],
                "fastbreak_id": row[1],
                "lock_timestamp": row[2],
                "buy_in_currency": row[3],
                "buy_in_amount": float(row[4]),
                "status": contest_status,
                "created_at": row[6],
                "display_name": row[7]
            }

            if contest_status == 'STARTED':
                if lock_ts >= twenty_four_hours_ago:
                    recent_started.append(contest_data)
                else:
                    older_started.append(contest_data)
            elif contest_status == 'OPEN':
                open_contests.append(contest_data)

        return jsonify(recent_started + open_contests + older_started)

    @app.route("/api/fastbreak/contest/<int:contest_id>/prediction-leaderboard", methods=["GET"])
    def get_fastbreak_prediction_leaderboard(contest_id):
        _MAX_WORKERS = 8
        user_wallet = request.args.get('userWallet', '').lower()

        db = get_db()
        cursor = db.cursor()

        # Contest info
        cursor.execute(prepare_query('''
            SELECT lock_timestamp, buy_in_amount, status, fastbreak_id
            FROM fastbreakContests
            WHERE id = ?
        '''), (contest_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"error": "Contest not found"}), 404

        lock_timestamp, buy_in_amount, status, fastbreak_id = row
        now_ts = int(datetime.datetime.now(datetime.UTC).timestamp())
        is_started = (status == 'CLOSED') or (status == 'OPEN' and int(lock_timestamp) < now_ts)

        # NOT_STARTED: show only user's entries
        if not is_started:
            cursor.execute(prepare_query('''
                SELECT COUNT(1)
                FROM fastbreakContestEntries
                WHERE contest_id = ?
            '''), (contest_id,))
            total_entries = int(cursor.fetchone()[0] or 0)
            total_pot = total_entries * float(buy_in_amount) * 0.95

            cursor.execute(prepare_query('''
                SELECT userWalletAddress, topshotUsernamePrediction, created_at
                FROM fastbreakContestEntries
                WHERE contest_id = ? AND LOWER(userWalletAddress) = ?
            '''), (contest_id, user_wallet))
            user_rows = cursor.fetchall()

            memo = {}
            user_entries = []
            for wallet_addr, prediction, created_at in user_rows:
                if prediction not in memo:
                    memo[prediction] = get_rank_and_lineup_for_user(prediction, fastbreak_id)
                stats = memo[prediction]
                user_entries.append({
                    "wallet": (wallet_addr or "").lower(),
                    "prediction": prediction,
                    "rank": stats.get("rank"),
                    "points": stats.get("points"),
                    "lineup": stats.get("players"),
                    "createdAt": created_at if isinstance(created_at, str)
                                  else (created_at.isoformat() if isinstance(created_at, datetime.datetime) else None),
                })

            return jsonify({
                "status": "NOT_STARTED",
                "totalEntries": total_entries,
                "totalPot": total_pot,
                "userEntries": user_entries
            })

        # STARTED: full leaderboard
        cursor.execute(prepare_query('''
            SELECT userWalletAddress, topshotUsernamePrediction, created_at
            FROM fastbreakContestEntries
            WHERE contest_id = ?
        '''), (contest_id,))
        entries = cursor.fetchall()

        total_entries = len(entries)
        total_pot = total_entries * float(buy_in_amount) * 0.95

        predictions = [e[1] for e in entries]
        unique_predictions = list({p for p in predictions if p})

        stats_map = {}

        def _fetch(pred):
            return pred, get_rank_and_lineup_for_user(pred, fastbreak_id)

        with ThreadPoolExecutor(max_workers=_MAX_WORKERS) as pool:
            futures = {pool.submit(_fetch, pred): pred for pred in unique_predictions}
            for fut in as_completed(futures):
                pred, data = fut.result()
                stats_map[pred] = data

        def _to_epoch_seconds(dt_val) -> int:
            if dt_val is None:
                return 2_147_483_647
            if isinstance(dt_val, (int, float)):
                return int(dt_val)
            if isinstance(dt_val, datetime.datetime):
                if dt_val.tzinfo is None:
                    dt_val = dt_val.replace(tzinfo=datetime.UTC)
                return int(dt_val.timestamp())
            if isinstance(dt_val, str):
                try:
                    dt = datetime.datetime.fromisoformat(dt_val)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=datetime.UTC)
                    return int(dt.timestamp())
                except Exception:
                    return 2_147_483_647
            return 2_147_483_647

        result_entries = []
        for wallet_addr, prediction, created_at in entries:
            wallet = (wallet_addr or "").lower()
            stats = stats_map.get(prediction, {})
            created_epoch = _to_epoch_seconds(created_at)
            result_entries.append({
                "wallet": wallet,
                "prediction": prediction,
                "rank": stats.get("rank"),
                "points": stats.get("points"),
                "lineup": stats.get("players"),
                "createdAt": created_at if isinstance(created_at, str)
                              else (created_at.isoformat() if isinstance(created_at, datetime.datetime) else None),
                "_createdEpoch": created_epoch,
                "isUser": (wallet == user_wallet),
            })

        def _sort_key(x):
            r = x["rank"]
            rank_key = r if isinstance(r, int) and r is not None else 1_000_000_000
            return (rank_key, x["_createdEpoch"])

        result_entries.sort(key=_sort_key)
        for i, item in enumerate(result_entries):
            item["position"] = i + 1
            item.pop("_createdEpoch", None)

        return jsonify({
            "status": "STARTED",
            "entries": result_entries,
            "totalEntries": total_entries,
            "totalPot": total_pot,
        })

    @app.route("/api/fastbreak/contest/<int:contest_id>/entries", methods=["GET"])
    def api_list_fastbreak_entries(contest_id):
        db = get_db()
        cursor = db.cursor()
        
        cursor.execute(prepare_query('''
            SELECT lock_timestamp, status
            FROM fastbreakContests
            WHERE id = ?
        '''), (contest_id,))
        row = cursor.fetchone()

        if not row:
            return jsonify({"error": "Contest not found"}), 404

        lock_timestamp, status = row
        now_ts = int(datetime.datetime.now(datetime.UTC).timestamp())

        is_started = False
        try:
            if status == 'CLOSED':
                is_started = True
            elif status == 'OPEN' and int(lock_timestamp) < now_ts:
                is_started = True
        except:
            pass

        if not is_started:
            return jsonify({"error": "Entries are not available before the contest locks."}), 403

        cursor.execute(prepare_query('''
            SELECT id, contest_id, topshotUsernamePrediction, userWalletAddress, created_at
            FROM fastbreakContestEntries
            WHERE contest_id = ?
            ORDER BY created_at ASC
        '''), (contest_id,))
        rows = cursor.fetchall()

        entries = []
        for row in rows:
            entries.append({
                "id": row[0],
                "contest_id": row[1],
                "topshotUsernamePrediction": row[2],
                "userWalletAddress": row[3],
                "created_at": row[4]
            })

        return jsonify(entries)

    @app.route("/api/fastbreak/contest/<int:contest_id>/entries/user/<wallet_address>", methods=["GET"])
    def api_list_user_fastbreak_entries(contest_id, wallet_address):
        db = get_db()
        cursor = db.cursor()
        
        cursor.execute(prepare_query('''
            SELECT id, contest_id, topshotUsernamePrediction, userWalletAddress, created_at
            FROM fastbreakContestEntries
            WHERE contest_id = ? AND userWalletAddress = ?
            ORDER BY created_at ASC
        '''), (contest_id, wallet_address))
        rows = cursor.fetchall()

        entries = []
        for row in rows:
            entries.append({
                "id": row[0],
                "contest_id": row[1],
                "topshotUsernamePrediction": row[2],
                "userWalletAddress": row[3],
                "created_at": row[4]
            })

        return jsonify(entries)

    @app.route("/api/fastbreak/contest/<int:contest_id>/entries", methods=["POST"])
    def add_fastbreak_entry(contest_id):
        from db.init import get_db_connection
        conn, _ = get_db_connection()
        cursor = conn.cursor()
        
        data = request.get_json()
        user_wallet = data.get("userWalletAddress")
        prediction = data.get("topshotUsernamePrediction")

        if not user_wallet or not prediction:
            return jsonify({"error": "Missing data"}), 400

        cursor.execute(prepare_query('''
            SELECT lock_timestamp, status
            FROM fastbreakContests
            WHERE id = ?
            ORDER BY lock_timestamp ASC
        '''), (contest_id,))
        row = cursor.fetchone()

        if not row:
            return jsonify({"error": "Contest not found"}), 404

        lock_timestamp, status = row
        now_ts = int(datetime.datetime.now(datetime.UTC).timestamp())

        if status != "OPEN":
            return jsonify({"error": "This contest is no longer accepting entries."}), 403

        if int(lock_timestamp) <= now_ts:
            return jsonify({"error": "This contest is already locked for new entries."}), 403

        cursor.execute(prepare_query('''
            INSERT INTO fastbreakContestEntries (contest_id, userWalletAddress, topshotUsernamePrediction)
            VALUES (?, ?, ?)
        '''), (contest_id, user_wallet.lower(), prediction))
        conn.commit()

        return jsonify({"success": True})

    @app.route("/api/fastbreak_racing_stats/<username>")
    def fastbreak_racing_stats_user(username):
        db = get_db()
        cursor = db.cursor()

        cursor.execute(prepare_query('''
            SELECT fb.game_date, fr.rank
            FROM fastbreak_rankings fr
            JOIN fastbreaks fb ON fr.fastbreak_id = fb.id
            WHERE LOWER(fr.username) = LOWER(?)
            ORDER BY fb.game_date DESC
            LIMIT 15
        '''), (username,))

        rows = cursor.fetchall()

        rankings = [
            {
                "gameDate": game_date,
                "rank": rank
            }
            for game_date, rank in rows
        ]

        rank_values = [r["rank"] for r in rankings]

        best = min(rank_values) if rank_values else None
        mean = round(statistics.mean(rank_values), 2) if rank_values else None
        median = statistics.median(rank_values) if rank_values else None
        flow_wallet = get_flow_wallet_from_ts_username(username)

        return jsonify({
            "username": username,
            "rankings": rankings,
            "best": best,
            "mean": mean,
            "median": median,
            "flow_wallet": flow_wallet
        })

    @app.route("/api/linked_username/<wallet>")
    def fastbreak_username(wallet):
        username = get_ts_username_from_flow_wallet(wallet)
        return jsonify({"username": username})

    @app.route("/api/fastbreak_racing_stats")
    def fastbreak_racing_stats_general():
        db = get_db()
        cursor = db.cursor()

        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", 25))
        offset = (page - 1) * per_page

        cursor.execute(prepare_query('''
            SELECT username, best, mean
            FROM user_rankings_summary
            WHERE total_entries > 10
            ORDER BY mean ASC
            LIMIT ? OFFSET ?
        '''), (per_page, offset))
        rows = cursor.fetchall()

        leaderboard = [
            {
                "username": username,
                "best": best,
                "mean": float(mean)
            }
            for username, best, mean in rows
        ]

        cursor.execute('SELECT COUNT(*) FROM user_rankings_summary')
        total_users = cursor.fetchone()[0]

        return jsonify({
            "page": page,
            "per_page": per_page,
            "total_users": total_users,
            "leaderboard": leaderboard
        })

    @app.route("/api/fastbreak_racing_usernames")
    def fastbreak_racing_usernames():
        db = get_db()
        cursor = db.cursor()
        
        cursor.execute('''
            SELECT DISTINCT username
            FROM user_rankings_summary
            WHERE total_entries > 1
            ORDER BY username
        ''')
        usernames = [row[0] for row in cursor.fetchall()]
        return jsonify(usernames)

    @app.route("/api/has_lineup")
    def has_lineup():
        username = request.args.get("username")
        fastbreak_id = request.args.get("fastbreak_id")

        if not username or not fastbreak_id:
            return jsonify({"error": "Missing required parameters"}), 400

        return jsonify({"hasLineup": bool(get_rank_and_lineup_for_user(username, fastbreak_id))})

    @app.route("/api/museum")
    def museum_editions():
        """Get all Jokic editions from TopShot marketplace.
        Optional query param: wallet=<flow_address> to include userOwnedCount."""
        try:
            wallet = request.args.get('wallet', '')
            dapper_id = ''
            if wallet:
                dapper_id = get_dapper_id_from_flow_wallet(wallet)
            result = get_jokic_editions(dapper_id=dapper_id)
            return jsonify(result)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route("/api/treasury/editions")
    def treasury_editions():
        """Get all Jokic editions owned by the treasury wallet.

        Returns editions where userOwnedCount > 0, sorted by owned count
        descending.  Uses the same get_jokic_editions helper as /api/museum
        but passes the treasury Dapper ID so the TopShot API populates
        userOwnedCount.
        """
        try:
            dapper_id = get_dapper_id_from_flow_wallet(FLOW_ACCOUNT)
            if not dapper_id:
                return jsonify({"error": "Could not resolve treasury dapper ID"}), 500
            result = get_jokic_editions(dapper_id=dapper_id)
            owned = [e for e in result.get("editions", []) if e.get("userOwnedCount", 0) > 0]
            owned.sort(key=lambda e: e["userOwnedCount"], reverse=True)
            # Rebuild tier breakdown for owned only
            tier_counts = {}
            for ed in owned:
                tier_counts[ed["tier"]] = tier_counts.get(ed["tier"], 0) + ed["userOwnedCount"]
            return jsonify({
                "totalEditions": len(owned),
                "totalMoments": sum(e["userOwnedCount"] for e in owned),
                "editions": owned,
                "tierBreakdown": tier_counts,
            })
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # ── Showcase helpers ────────────────────────────────────────────
    _TS_HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) "
                      "Chrome/131.0.0.0 Safari/537.36",
    }

    def _fetch_minted_moment(moment_id):
        """Fetch moment detail via TopShot GraphQL API; return dict or None."""
        try:
            gql_query = """query GetMintedMoment($momentId: ID!) {
  getMintedMoment(momentId: $momentId) {
    data {
      id version tier tags { id title visible level }
      set { id flowName flowSeriesNumber setVisualId }
      setPlay {
        ID flowRetired
        tags { id title visible level }
        circulations {
          circulationCount forSaleByCollectors burned locked
          hiddenInPacks ownedByCollectors
        }
      }
      parallelSetPlay {
        circulations {
          circulationCount forSaleByCollectors burned locked
          hiddenInPacks ownedByCollectors
        }
      }
      assetPathPrefix
      play {
        id description shortDescription keyStats
        tags { id title visible level }
        stats {
          playerName playCategory dateOfMoment teamAtMoment
          nbaSeason jerseyNumber
          homeTeamName homeTeamScore awayTeamName awayTeamScore
        }
        statsPlayerGameScores {
          points rebounds assists steals blocks minutes
          fieldGoalsMade fieldGoalsAttempted
          threePointsMade threePointsAttempted
          freeThrowsMade freeThrowsAttempted
        }
        statsPlayerSeasonAverageScores {
          points rebounds assists steals blocks
        }
      }
      flowSerialNumber forSale price lowAsk highestOffer
      lastPurchasePrice
      owner { username flowAddress }
      edition {
        marketplaceInfo {
          priceRange { min }
          averageSaleData { averagePrice }
        }
      }
      topshotScore { score averageSalePrice }
      parallelID
    }
  }
}"""
            resp = http_requests.post(
                "https://public-api.nbatopshot.com/graphql",
                json={
                    "operationName": "GetMintedMoment",
                    "query": gql_query,
                    "variables": {"momentId": moment_id},
                },
                headers={**_TS_HEADERS, "Content-Type": "application/json"},
                timeout=20,
            )
            resp.raise_for_status()
            data = resp.json()
            return (data.get("data") or {}).get("getMintedMoment", {}).get("data")
        except Exception:
            return None

    # Badge title → camelCase slug for GIF filenames
    _BADGE_TITLE_MAP = {
        "Top Shot Debut": "topShotDebut",
        "Rookie Year": "rookieYear",
        "Rookie Mint": "rookieMint",
        "Rookie Premiere": "rookiePremiere",
        "MVP Year": "mvpYear",
        "Championship Year": "championshipYear",
    }

    def _extract_badge_tags(play, set_play):
        """Collect visible badge tags from play.tags + setPlay.tags; return list of camelCase slugs."""
        raw = []
        for src in (play, set_play):
            for t in (src.get("tags") or []):
                if isinstance(t, dict) and t.get("visible"):
                    slug = _BADGE_TITLE_MAP.get(t.get("title", ""))
                    if slug:
                        raw.append(slug)
        # deduplicate while preserving order
        seen = set()
        result = []
        for s in raw:
            if s not in seen:
                seen.add(s)
                result.append(s)
        return result

    def _moment_to_edition(m):
        """Transform a GetMintedMoment data dict into the Museum edition shape."""
        play = m.get("play") or {}
        stats = play.get("stats") or {}
        game = play.get("statsPlayerGameScores") or {}
        season_avg = play.get("statsPlayerSeasonAverageScores") or {}
        set_info = m.get("set") or {}
        set_play = m.get("setPlay") or {}
        circulations = (set_play.get("circulations")
                        or (m.get("parallelSetPlay") or {}).get("circulations")
                        or {})

        raw_tier = m.get("tier") or "MOMENT_TIER_COMMON"
        tier = raw_tier.replace("MOMENT_TIER_", "")

        asset_prefix = m.get("assetPathPrefix") or ""
        image_url = f"{asset_prefix}Hero_2880_2880_Black.jpg" if asset_prefix else ""
        video_url = f"{asset_prefix}Animated_1080_1080_Black.mp4" if asset_prefix else ""

        mkt = (m.get("edition") or {}).get("marketplaceInfo") or {}
        ts_score = m.get("topshotScore") or {}
        owner = m.get("owner") or {}

        # Collect badge tags from play.tags + setPlay.tags; map title→slug
        tags = _extract_badge_tags(play, set_play)

        return {
            "id": m.get("id"),
            "playId": play.get("id", ""),
            "tier": tier,
            "tags": tags,
            "setName": set_info.get("flowName", "Unknown Set"),
            "setVisualId": set_info.get("setVisualId", ""),
            "seriesNumber": set_info.get("flowSeriesNumber"),
            "playCategory": stats.get("playCategory", ""),
            "playerName": stats.get("playerName", ""),
            "dateOfMoment": stats.get("dateOfMoment", ""),
            "teamAtMoment": stats.get("teamAtMoment", ""),
            "nbaSeason": stats.get("nbaSeason", ""),
            "jerseyNumber": stats.get("jerseyNumber", ""),
            "shortDescription": play.get("shortDescription", ""),
            "description": play.get("description", ""),
            "circulationCount": circulations.get("circulationCount"),
            "forSaleCount": circulations.get("forSaleByCollectors", 0),
            "burned": circulations.get("burned", 0),
            "locked": circulations.get("locked", 0),
            "retired": set_play.get("flowRetired", False),
            "imageUrl": image_url,
            "videoUrl": video_url,
            "gameStats": {
                "points": game.get("points"),
                "rebounds": game.get("rebounds"),
                "assists": game.get("assists"),
                "steals": game.get("steals"),
                "blocks": game.get("blocks"),
                "minutes": game.get("minutes"),
                "fieldGoalsMade": game.get("fieldGoalsMade"),
                "fieldGoalsAttempted": game.get("fieldGoalsAttempted"),
                "threePointsMade": game.get("threePointsMade"),
                "threePointsAttempted": game.get("threePointsAttempted"),
                "freeThrowsMade": game.get("freeThrowsMade"),
                "freeThrowsAttempted": game.get("freeThrowsAttempted"),
            } if game else None,
            "seasonAverages": {
                "points": season_avg.get("points"),
                "rebounds": season_avg.get("rebounds"),
                "assists": season_avg.get("assists"),
                "steals": season_avg.get("steals"),
                "blocks": season_avg.get("blocks"),
            } if season_avg else None,
            "keyStats": play.get("keyStats"),
            "flowSerialNumber": m.get("flowSerialNumber"),
            "parallelID": m.get("parallelID", 0),
            "price": m.get("price"),
            "lowAsk": m.get("lowAsk"),
            "highestOffer": m.get("highestOffer"),
            "lastPurchasePrice": m.get("lastPurchasePrice"),
            "topshotScore": ts_score.get("score"),
            "averageSalePrice": ts_score.get("averageSalePrice"),
            "floorPrice": (mkt.get("priceRange") or {}).get("min"),
            "ownerUsername": owner.get("username"),
            "forSale": m.get("forSale", False),
            "userOwnedCount": 0,
            # Game context
            "homeTeamName": stats.get("homeTeamName", ""),
            "homeTeamScore": stats.get("homeTeamScore"),
            "awayTeamName": stats.get("awayTeamName", ""),
            "awayTeamScore": stats.get("awayTeamScore"),
        }

    def _moment_to_edition_light(m):
        """Fallback: build edition from __NEXT_DATA__ moment (no game stats)."""
        play = m.get("play") or {}
        stats = play.get("stats") or {}
        set_info = m.get("set") or {}
        set_play = m.get("setPlay") or {}
        circulations = (set_play.get("circulations")
                        or (m.get("parallelSetPlay") or {}).get("circulations")
                        or {})
        raw_tier = m.get("tier") or "MOMENT_TIER_COMMON"
        tier = raw_tier.replace("MOMENT_TIER_", "")
        asset_prefix = m.get("assetPathPrefix") or ""
        image_url = f"{asset_prefix}Hero_2880_2880_Black.jpg" if asset_prefix else ""
        video_url = f"{asset_prefix}Animated_1080_1080_Black.mp4" if asset_prefix else ""

        # Collect badge tags from play.tags + setPlay.tags
        tags_l = _extract_badge_tags(play, set_play)

        return {
            "id": m.get("id"),
            "playId": play.get("id", ""),
            "tier": tier,
            "tags": tags_l,
            "setName": set_info.get("flowName", "Unknown Set"),
            "setVisualId": set_info.get("setVisualId", ""),
            "seriesNumber": set_info.get("flowSeriesNumber"),
            "playCategory": stats.get("playCategory", ""),
            "playerName": stats.get("playerName", ""),
            "dateOfMoment": stats.get("dateOfMoment", ""),
            "teamAtMoment": stats.get("teamAtMoment", ""),
            "nbaSeason": stats.get("nbaSeason", ""),
            "jerseyNumber": stats.get("jerseyNumber", ""),
            "shortDescription": play.get("shortDescription", ""),
            "description": play.get("description", ""),
            "circulationCount": circulations.get("circulationCount"),
            "forSaleCount": circulations.get("forSaleByCollectors", 0),
            "burned": circulations.get("burned", 0),
            "locked": circulations.get("locked", 0),
            "retired": set_play.get("flowRetired", False),
            "imageUrl": image_url,
            "videoUrl": video_url,
            "gameStats": None,
            "flowSerialNumber": m.get("flowSerialNumber"),
            "parallelID": m.get("parallelID", 0),
            "userOwnedCount": 0,
        }

    @app.route("/api/showcase/<binder_id>")
    def museum_showcase(binder_id):
        """Fetch a TopShot showcase and enrich each moment via GetMintedMoment."""
        import re, json as json_mod
        if not re.match(r'^[0-9a-f\-]{36}$', binder_id):
            return jsonify({"error": "Invalid showcase ID"}), 400

        try:
            # Step 1: Scrape __NEXT_DATA__ for moment IDs + showcase name
            resp = http_requests.get(
                f"https://nbatopshot.com/showcase/{binder_id}",
                headers=_TS_HEADERS,
                timeout=30,
            )
            resp.raise_for_status()

            marker = '__NEXT_DATA__" type="application/json"'
            idx = resp.text.find(marker)
            if idx < 0:
                return jsonify({"error": "Could not parse showcase page"}), 502

            json_start = resp.text.find('>', idx + len(marker)) + 1
            json_end = resp.text.find('</script>', json_start)
            next_data = json_mod.loads(resp.text[json_start:json_end])

            binder = next_data.get("props", {}).get("pageProps", {}).get("binder")
            if not binder:
                return jsonify({"error": "Showcase not found"}), 404

            # Collect all moments from binder pages (preserving order)
            binder_moments = []
            for page in binder.get("pages") or []:
                for m in page.get("moments") or []:
                    binder_moments.append(m)

            if not binder_moments:
                return jsonify({"editions": [], "showcaseName": binder.get("name", "Showcase")})

            # Step 2: Enrich each moment via GetMintedMoment (parallel)
            enriched = {}
            with ThreadPoolExecutor(max_workers=min(len(binder_moments), 10)) as pool:
                future_to_id = {
                    pool.submit(_fetch_minted_moment, m["id"]): m["id"]
                    for m in binder_moments if m.get("id")
                }
                for future in as_completed(future_to_id):
                    mid = future_to_id[future]
                    result = future.result()
                    if result:
                        enriched[mid] = result

            # Step 3: Build editions – use enriched data where available, fall back to __NEXT_DATA__
            editions = []
            for m in binder_moments:
                mid = m.get("id")
                rich = enriched.get(mid)
                if rich:
                    editions.append(_moment_to_edition(rich))
                else:
                    editions.append(_moment_to_edition_light(m))

            return jsonify({
                "editions": editions,
                "showcaseName": binder.get("name", "Showcase"),
            })
        except http_requests.RequestException as e:
            return jsonify({"error": f"Failed to fetch showcase: {str(e)}"}), 502
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route("/api/blog/comments/<article_id>", methods=['GET'])
    def get_comments(article_id):
        """Get all comments for a blog article."""
        db = get_db()
        cursor = db.cursor()
        
        query = prepare_query('''
            SELECT id, author_name, comment_text, timestamp, parent_id
            FROM blog_comments
            WHERE article_id = ?
            ORDER BY timestamp ASC
        ''')
        cursor.execute(query, (article_id,))
        
        comments = []
        for row in cursor.fetchall():
            comments.append({
                'id': row[0],
                'author_name': row[1],
                'comment_text': row[2],
                'timestamp': row[3],
                'parent_id': row[4]
            })
        
        return jsonify(comments)

    @app.route("/api/blog/comments", methods=['GET', 'POST'])
    def handle_comments():
        """Handle blog comments - GET to list all, POST to create new."""
        if request.method == 'GET':
            # Return empty array or all comments
            return jsonify([])
        
        # POST method
        data = request.json
        
        article_id = data.get('article_id')
        author_name = data.get('author_name', 'Anonymous')
        comment_text = data.get('comment_text')
        parent_id = data.get('parent_id')
        
        if not article_id or not comment_text:
            return jsonify({"error": "Missing required fields"}), 400
        
        # Basic validation
        if len(author_name) > 50:
            return jsonify({"error": "Author name too long"}), 400
        if len(comment_text) > 2000:
            return jsonify({"error": "Comment too long"}), 400
        
        db = get_db()
        cursor = db.cursor()
        
        timestamp = int(time.time())
        
        query = prepare_query('''
            INSERT INTO blog_comments (article_id, author_name, comment_text, timestamp, parent_id)
            VALUES (?, ?, ?, ?, ?)
        ''')
        cursor.execute(query, (article_id, author_name, comment_text, timestamp, parent_id))
        db.commit()
        
        # Get the inserted comment ID
        if hasattr(cursor, 'lastrowid'):
            comment_id = cursor.lastrowid
        else:
            cursor.execute('SELECT lastval()')
            comment_id = cursor.fetchone()[0]
        
        return jsonify({
            'id': comment_id,
            'article_id': article_id,
            'author_name': author_name,
            'comment_text': comment_text,
            'timestamp': timestamp,
            'parent_id': parent_id
        }), 201

    # ──────────────────────────────────────────────────────────
    #  Moments lookup endpoint (swap feature)
    # ──────────────────────────────────────────────────────────

    @app.route('/api/moment-lookup', methods=['POST'])
    def api_moments_lookup():
        """Look up which user moments are Jokic editions stored in our DB.

        Expects JSON: { moments: [{id, playID, setID, serial}, ...] }
        Returns JSON: { moments: [...enriched Jokic moments...] }
        """
        data = request.get_json(force=True) or {}
        moments_in = data.get('moments', [])
        if not moments_in:
            return jsonify({'moments': []})

        db = get_db()
        cur = db.cursor()

        results = []
        cache_rows = []

        for m in moments_in:
            mid = m.get('id')
            play_id = str(m.get('playID', ''))
            set_name = m.get('setName', '')
            serial = m.get('serial', 0)
            subedition = m.get('subedition', 0)

            # Use subedition (parallel ID from on-chain getMomentsSubedition)
            # to match the correct edition row. The edition_id format is
            # "{setUUID}+{playUUID}+{parallelID}".
            # If exact parallel match fails, fall back to standard (+0).
            edition_suffix = '+' + str(subedition)
            _edition_q = prepare_query(
                "SELECT edition_id, tier, set_name, series_number, "
                "play_headline, play_category, team, date_of_moment, "
                "nba_season, jersey_number, image_url, video_url, "
                "circulation_count, low_ask "
                "FROM jokic_editions WHERE play_flow_id = ? AND set_name = ? "
                "ORDER BY CASE WHEN edition_id LIKE ? THEN 0 ELSE 1 END "
                "LIMIT 1"
            )
            cur.execute(
                _edition_q,
                (int(play_id), set_name, '%' + edition_suffix),
            )
            row = cur.fetchone()

            # Fallback: on-chain set names can differ from API names
            # (e.g. 'Base Set6' on-chain vs 'Base Set' in DB).
            # Retry matching by play_flow_id only.
            if not row:
                cur.execute(
                    prepare_query(
                        "SELECT edition_id, tier, set_name, series_number, "
                        "play_headline, play_category, team, date_of_moment, "
                        "nba_season, jersey_number, image_url, video_url, "
                        "circulation_count, low_ask "
                        "FROM jokic_editions WHERE play_flow_id = ? "
                        "ORDER BY CASE WHEN edition_id LIKE ? THEN 0 ELSE 1 END "
                        "LIMIT 1"
                    ),
                    (int(play_id), '%' + edition_suffix),
                )
                row = cur.fetchone()
            if not row:
                continue

            results.append({
                'id': mid,
                'serial': serial,
                'editionId': row[0],
                'tier': row[1],
                'setName': row[2] or '',
                'seriesNumber': row[3],
                'player': 'Nikola Jokić',
                'headline': row[4] or '',
                'playCategory': row[5] or '',
                'team': row[6] or '',
                'dateOfMoment': row[7] or '',
                'nbaSeason': row[8] or '',
                'jerseyNumber': row[9] or '',
                'imageUrl': row[10] or '',
                'videoUrl': row[11] or '',
                'circulationCount': row[12],
                'lowAsk': row[13],
            })

            cache_rows.append(
                (mid, row[0], play_id, set_name, serial, row[1], int(time.time()))
            )

        # Cache moment→edition mapping for swap/complete
        for c in cache_rows:
            cur.execute(
                prepare_query(
                    "INSERT INTO jokic_moments "
                    "(moment_id, edition_id, play_id, set_id, serial_number, tier, cached_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?) "
                    "ON CONFLICT DO NOTHING"
                ),
                c,
            )
        db.commit()

        return jsonify({'moments': results})

    # ──────────────────────────────────────────────────────────
    #  Swap endpoint: moments → $MVP
    # ──────────────────────────────────────────────────────────

    # Tier → $MVP mapping for selling moments to treasury
    _SWAP_MVP_RATES = {
        'COMMON': 1.5,
        'FANDOM': 1.5,
        'RARE': 75,
        'LEGENDARY': 1500,
    }

    # Tier → raffle-point mapping (NFT boost does NOT affect points)
    _SWAP_POINT_RATES = {
        'COMMON': 1,
        'FANDOM': 1,
        'RARE': 50,
        'LEGENDARY': 1000,
    }

    # Tier → $MVP mapping for buying moments from treasury (higher price)
    _BUY_MVP_RATES = {
        'COMMON': 2,
        'FANDOM': 2,
        'RARE': 100,
        'LEGENDARY': 2000,
    }

    @app.route('/api/swap/complete', methods=['POST'])
    def api_swap_complete():
        """Verify moment transfer tx on-chain and send $MVP from treasury.

        Expects JSON: { txId, userAddr, momentIds }
        Returns JSON: { mvpAmount, mvpTxId }

        Security:
        1. Replay protection – rejects txId already in completed_swaps.
        2. On-chain verification – queries Flow REST API to confirm the
           transaction is sealed and TopShot.Deposit events prove the
           claimed moments arrived at the treasury address.
        3. Only then sends $MVP from treasury.
        """
        import asyncio
        import json as _json
        import base64 as _b64

        data = request.get_json(force=True) or {}
        tx_id = data.get('txId', '').strip()
        user_addr = data.get('userAddr', '').strip()
        moment_ids = data.get('momentIds', [])
        boost_nft_id = data.get('boostNftId')  # optional horse NFT id

        if not tx_id or not user_addr or not moment_ids:
            return jsonify({'error': 'Missing txId, userAddr, or momentIds'}), 400

        # --- 0. Replay protection ---
        db = get_db()
        cur = db.cursor()
        cur.execute(
            prepare_query("SELECT tx_id FROM completed_swaps WHERE tx_id = ?"),
            (tx_id,),
        )
        if cur.fetchone():
            return jsonify({'error': 'This transaction has already been processed'}), 409

        # --- 1. On-chain verification via Flow REST API ---
        # Verify moments were deposited to the Dapper treasury wallet
        treasury_addr_clean = FLOW_ACCOUNT.removeprefix('0x').lower()
        try:
            flow_resp = http_requests.get(
                f'https://rest-mainnet.onflow.org/v1/transaction_results/{tx_id}',
                timeout=15,
            )
            if flow_resp.status_code != 200:
                return jsonify({'error': f'Could not fetch tx result from Flow (HTTP {flow_resp.status_code})'}), 502
            tx_result = flow_resp.json()
        except Exception as e:
            return jsonify({'error': f'Flow API error: {str(e)}'}), 502

        # Verify sealed
        tx_status = tx_result.get('status', '').upper()
        if tx_status != 'SEALED':
            return jsonify({'error': f'Transaction not sealed (status: {tx_status})'}), 400
        if tx_result.get('error_message'):
            return jsonify({'error': f'Transaction failed on-chain: {tx_result["error_message"]}'}), 400

        # Verify the transaction was proposed by the claiming user
        try:
            tx_body_resp = http_requests.get(
                f'https://rest-mainnet.onflow.org/v1/transactions/{tx_id}',
                timeout=10,
            )
            if tx_body_resp.status_code == 200:
                tx_body = tx_body_resp.json()
                proposer = tx_body.get('proposer', '').removeprefix('0x').lower()
                claimed = user_addr.removeprefix('0x').lower()
                if proposer and proposer != claimed:
                    return jsonify({'error': 'Transaction proposer does not match your wallet'}), 403
        except Exception:
            pass  # non-fatal — event verification is the primary guard

        # Parse TopShot.Deposit events to verify moments arrived at treasury
        deposited_ids = set()
        deposit_event_type = 'A.0b2a3299cc857e29.TopShot.Deposit'
        for ev in tx_result.get('events', []):
            if ev.get('type') != deposit_event_type:
                continue
            try:
                payload = _json.loads(_b64.b64decode(ev['payload']).decode('utf-8'))
                fields = payload.get('value', {}).get('fields', [])
                ev_id = None
                ev_to = None
                for f in fields:
                    if f.get('name') == 'id':
                        ev_id = int(f['value']['value'])
                    elif f.get('name') == 'to':
                        val = f.get('value', {})
                        # Optional<Address> — could be wrapped
                        if val.get('type') == 'Optional' and val.get('value'):
                            ev_to = val['value'].get('value', '').removeprefix('0x').lower()
                        elif val.get('value'):
                            ev_to = str(val['value']).removeprefix('0x').lower()
                if ev_id is not None and ev_to == treasury_addr_clean:
                    deposited_ids.add(ev_id)
            except Exception:
                continue

        # Every claimed moment must appear in deposits to treasury
        claimed_set = set(int(mid) for mid in moment_ids)
        missing = claimed_set - deposited_ids
        if missing:
            return jsonify({
                'error': f'On-chain verification failed: moments {sorted(missing)} '
                         f'not deposited to treasury in tx {tx_id}',
            }), 400

        # --- 1b. Horse NFT boost verification ---
        boost_verified = False
        if boost_nft_id is not None:
            boost_nft_id = int(boost_nft_id)
            # Swapboost30MVP uses Flowty UniversalCollection, so the on-chain
            # event is the standard NonFungibleToken.Deposited (not a custom
            # Swapboost30MVP.Deposit).  We match on the event type string and
            # additionally verify the embedded nftType contains our contract.
            swap_treasury_clean = FLOW_SWAP_ACCOUNT.removeprefix('0x').lower()
            nft_deposited_type = 'A.1d7e57aa55817448.NonFungibleToken.Deposited'
            horse_nft_type_fragment = 'Swapboost30MVP.NFT'
            for ev in tx_result.get('events', []):
                if ev.get('type') != nft_deposited_type:
                    continue
                try:
                    payload = _json.loads(_b64.b64decode(ev['payload']).decode('utf-8'))
                    fields = payload.get('value', {}).get('fields', [])
                    ev_id = None
                    ev_to = None
                    ev_nft_type = None
                    for f in fields:
                        if f.get('name') == 'id':
                            ev_id = int(f['value']['value'])
                        elif f.get('name') == 'to':
                            val = f.get('value', {})
                            if val.get('type') == 'Optional' and val.get('value'):
                                ev_to = val['value'].get('value', '').removeprefix('0x').lower()
                            elif val.get('value'):
                                ev_to = str(val['value']).removeprefix('0x').lower()
                        elif f.get('name') == 'type':
                            ev_nft_type = str(f['value'].get('value', ''))
                    if (ev_id == boost_nft_id
                            and ev_to == swap_treasury_clean
                            and ev_nft_type
                            and horse_nft_type_fragment in ev_nft_type):
                        boost_verified = True
                        break
                except Exception:
                    continue
            if not boost_verified:
                return jsonify({
                    'error': f'Horse NFT #{boost_nft_id} deposit to treasury not verified in tx {tx_id}',
                }), 400

        # --- 2. Look up tier for each moment (DB first, TopShot fallback) ---
        total_mvp = 0
        total_points = 0
        tier_counts = {}
        for mid in moment_ids:
            tier = _get_moment_tier(mid)
            if tier is None:
                return jsonify({'error': f'Could not fetch tier for moment {mid}'}), 502
            rate = _SWAP_MVP_RATES.get(tier, 0)
            if rate == 0:
                return jsonify({'error': f'Moment {mid} has unsupported tier: {tier}'}), 400
            total_mvp += rate
            total_points += _SWAP_POINT_RATES.get(tier, 1)
            tier_counts[tier] = tier_counts.get(tier, 0) + 1

        if total_mvp <= 0:
            return jsonify({'error': 'No $MVP value for selected moments'}), 400

        # Apply horse NFT boost (20% increase)
        boost_applied = False
        if boost_verified:
            total_mvp = total_mvp * 1.2
            boost_applied = True

        # --- 3. Send $MVP from treasury to user ---
        mvp_tx_id = None
        if not FLOW_SWAP_PRIVATE_KEY:
            # Treasury key not configured – record swap but note manual send
            note = 'Treasury key not configured; $MVP will be sent manually.'
        else:
            try:
                mvp_tx_id = asyncio.run(_send_mvp_from_treasury(user_addr, total_mvp))
                note = None
            except Exception as e:
                return jsonify({'error': f'Failed to send $MVP: {str(e)}'}), 500

        # --- 4. Record completed swap (replay protection) ---
        cur.execute(
            prepare_query(
                "INSERT INTO completed_swaps "
                "(tx_id, user_addr, moment_ids, mvp_amount, mvp_tx_id, completed_at, points) "
                "VALUES (?, ?, ?, ?, ?, ?, ?) "
                "ON CONFLICT DO NOTHING"
            ),
            (tx_id, user_addr, ','.join(str(m) for m in moment_ids),
             total_mvp, mvp_tx_id, int(time.time()), total_points),
        )
        db.commit()

        result = {
            'mvpAmount': total_mvp,
            'mvpTxId': mvp_tx_id,
            'tierCounts': tier_counts,
            'boostApplied': boost_applied,
            'points': total_points,
        }
        if note:
            result['note'] = note

        # --- 5. Send Discord notification (fire-and-forget) ---
        _notify_swap_discord(app, user_addr, moment_ids, total_mvp, tier_counts, tx_id, mvp_tx_id, boost_applied)

        return jsonify(result), 200

    # ─── Swap leaderboard ────────────────────────────────────────

    _points_backfill_done = [False]  # mutable flag

    def _backfill_swap_points():
        """One-time backfill: compute points for old completed_swaps rows
        that were inserted before the points column existed."""
        if _points_backfill_done[0]:
            return
        _points_backfill_done[0] = True

        try:
            db = get_db()
            cur = db.cursor()
            cur.execute(prepare_query(
                "SELECT tx_id, moment_ids FROM completed_swaps "
                "WHERE points = 0 AND mvp_amount > 0"
            ))
            rows = cur.fetchall()
            if not rows:
                return
            for tx_id_row, mids_str in rows:
                pts = 0
                for mid in mids_str.split(','):
                    mid = mid.strip()
                    if not mid:
                        continue
                    tier = _get_moment_tier(int(mid))
                    pts += _SWAP_POINT_RATES.get(tier, 1) if tier else 1
                cur.execute(
                    prepare_query(
                        "UPDATE completed_swaps SET points = ? WHERE tx_id = ?"
                    ),
                    (pts, tx_id_row),
                )
            db.commit()
            print(f"✅ Backfilled points for {len(rows)} completed_swaps rows")
        except Exception as e:
            print(f"⚠️  Points backfill error: {e}")

    @app.route('/api/swap/leaderboard')
    def api_swap_leaderboard():
        """Monthly swap leaderboard — $MVP earned per wallet per month.

        Optional query params:
          ?month=YYYY-MM   — filter to a specific month (default: current month)
        """
        _backfill_swap_points()
        db = get_db()
        cur = db.cursor()

        # Determine the requested month boundaries (UTC epoch)
        month_param = request.args.get('month')  # e.g. "2026-03"
        try:
            if month_param:
                year, mon = month_param.split('-')
                year, mon = int(year), int(mon)
            else:
                now = datetime.datetime.now(datetime.UTC)
                year, mon = now.year, now.month
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid month format. Use YYYY-MM'}), 400

        month_start = datetime.datetime(year, mon, 1, tzinfo=datetime.UTC)
        if mon == 12:
            month_end = datetime.datetime(year + 1, 1, 1, tzinfo=datetime.UTC)
        else:
            month_end = datetime.datetime(year, mon + 1, 1, tzinfo=datetime.UTC)

        start_ts = int(month_start.timestamp())
        end_ts = int(month_end.timestamp())

        cur.execute(prepare_query('''
            SELECT user_addr, SUM(mvp_amount) as total_mvp, COUNT(*) as swap_count,
                   SUM(points) as total_points
            FROM completed_swaps
            WHERE completed_at >= ? AND completed_at < ?
              AND mvp_amount > 0
            GROUP BY user_addr
            ORDER BY total_points DESC
        '''), (start_ts, end_ts))
        rows = cur.fetchall()

        # Resolve TopShot usernames in parallel
        addrs = [r[0] for r in rows]
        username_map = {}
        if addrs:
            def _lookup(addr):
                try:
                    return addr, get_ts_username_from_flow_wallet(addr)
                except Exception:
                    return addr, None
            with ThreadPoolExecutor(max_workers=min(len(addrs), 10)) as pool:
                for addr, uname in pool.map(lambda a: _lookup(a), addrs):
                    if uname:
                        username_map[addr] = uname

        # Also fetch the list of distinct months that have data
        cur.execute(prepare_query('''
            SELECT DISTINCT completed_at FROM completed_swaps
            ORDER BY completed_at ASC
        '''))
        all_ts = [r[0] for r in cur.fetchall()]
        seen_months = set()
        for ts in all_ts:
            dt = datetime.datetime.fromtimestamp(ts, tz=datetime.UTC)
            seen_months.add(f'{dt.year}-{dt.month:02d}')
        available_months = sorted(seen_months, reverse=True)

        leaderboard = []
        for rank, row in enumerate(rows, 1):
            addr, total_mvp, swap_count, total_points = row
            entry = {
                'rank': rank,
                'address': addr,
                'totalMvp': total_mvp,
                'swapCount': swap_count,
                'points': total_points or 0,
            }
            if addr in username_map:
                entry['topshotUsername'] = username_map[addr]
            leaderboard.append(entry)

        return jsonify({
            'month': f'{year}-{mon:02d}',
            'availableMonths': available_months,
            'leaderboard': leaderboard,
        })

    # ── NFT collection: all holders ────────────────────────────────
    _nft_holders_cache = {"data": None, "ts": 0}

    @app.route('/api/nft/holders')
    def api_nft_holders():
        """Return all Swapboost30MVP NFTs with owner info.

        Scans the chain by resolving HybridCustody parents for every
        known Dapper child address, then probing each parent for
        Swapboost NFTs.  Results are cached for 5 minutes.
        """
        import base64 as _b64

        now = time.time()
        if _nft_holders_cache["data"] and now - _nft_holders_cache["ts"] < 300:
            return jsonify(_nft_holders_cache["data"])

        from utils.helpers import DAPPER_WALLET_USERNAME_MAP

        dapper_children = list(DAPPER_WALLET_USERNAME_MAP.keys())
        child_to_username = {k.lower(): v for k, v in DAPPER_WALLET_USERNAME_MAP.items()}

        cadence = r"""
import NonFungibleToken from 0x1d7e57aa55817448
import MetadataViews from 0x1d7e57aa55817448
import Swapboost30MVP from 0xaad9f8fa31ecbaf9
import HybridCustody from 0xd8a7e05a7ac670c0

access(all) fun main(dapperChildren: [Address], directAddresses: [Address]): [[String]] {
  let totalSupply = Swapboost30MVP.totalSupply
  var result: [[String]] = []
  var checked: {Address: Bool} = {}

  // Check direct addresses first (e.g. treasury wallets)
  for addr in directAddresses {
    if checked[addr] != nil { continue }
    checked[addr] = true

    let acct = getAccount(addr)
    let col = acct.capabilities
      .borrow<&{NonFungibleToken.Collection}>(
        /public/Swapboost30MVP_aad9f8fa31ecbaf9
      )
    if col == nil { continue }

    var id: UInt64 = 1
    while id <= totalSupply {
      let nft = col!.borrowNFT(id)
      if nft != nil {
        var name = ""
        var thumb = ""
        if let display = nft!.resolveView(Type<MetadataViews.Display>()) {
          let d = display as! MetadataViews.Display
          name = d.name
          thumb = d.thumbnail.uri()
        }
        result.append([
          id.toString(), name, thumb,
          addr.toString(), addr.toString()
        ])
      }
      id = id + 1
    }
  }

  // Then discover via HybridCustody parents of Dapper children
  for child in dapperChildren {
    let childAcct = getAuthAccount<auth(Storage) &Account>(child)
    let ownedAcct = childAcct.storage
      .borrow<auth(HybridCustody.Owner) &HybridCustody.OwnedAccount>(
        from: HybridCustody.OwnedAccountStoragePath
      )
    if ownedAcct == nil { continue }
    let parents = ownedAcct!.getParentAddresses()

    for parent in parents {
      if checked[parent] != nil { continue }
      checked[parent] = true

      let acct = getAccount(parent)
      let col = acct.capabilities
        .borrow<&{NonFungibleToken.Collection}>(
          /public/Swapboost30MVP_aad9f8fa31ecbaf9
        )
      if col == nil { continue }

      var id: UInt64 = 1
      while id <= totalSupply {
        let nft = col!.borrowNFT(id)
        if nft != nil {
          var name = ""
          var thumb = ""
          if let display = nft!.resolveView(Type<MetadataViews.Display>()) {
            let d = display as! MetadataViews.Display
            name = d.name
            thumb = d.thumbnail.uri()
          }
          result.append([
            id.toString(), name, thumb,
            parent.toString(), child.toString()
          ])
        }
        id = id + 1
      }
    }
  }
  return result
}
"""
        import json as _json

        args_val = [{"type": "Address", "value": a} for a in dapper_children]
        direct_val = [{"type": "Address", "value": f"0x{FLOW_SWAP_ACCOUNT.removeprefix('0x')}"}]
        body = {
            "script": _b64.b64encode(cadence.encode()).decode(),
            "arguments": [
                _b64.b64encode(
                    _json.dumps({"type": "Array", "value": args_val}).encode()
                ).decode(),
                _b64.b64encode(
                    _json.dumps({"type": "Array", "value": direct_val}).encode()
                ).decode(),
            ],
        }

        try:
            resp = http_requests.post(
                "https://rest-mainnet.onflow.org/v1/scripts",
                json=body, timeout=30,
            )
            if resp.status_code != 200:
                return jsonify({"error": "chain query failed"}), 502

            raw = resp.json()
            decoded = _json.loads(_b64.b64decode(raw).decode()) if isinstance(raw, str) else raw
            entries = decoded.get("value", [])

            nfts = []
            for entry in entries:
                vals = [v["value"] for v in entry["value"]]
                nft_id, name, thumb, owner, dapper = vals
                nid = int(nft_id)
                horse = HORSE_NAMES.get(nid)
                display_name = f"{horse} #{nid}" if horse else name
                username = child_to_username.get(dapper.lower())
                nfts.append({
                    "id": nid,
                    "name": display_name,
                    "thumbnail": thumb,
                    "owner": owner,
                    "dapper": dapper,
                    "username": username,
                })

            nfts.sort(key=lambda n: n["id"])
            result = {"totalSupply": 50, "nfts": nfts}
            _nft_holders_cache["data"] = result
            _nft_holders_cache["ts"] = now
            return jsonify(result)
        except Exception as exc:
            return jsonify({"error": str(exc)}), 500

    # ──────────────────────────────────────────────────────────
    #  Treasury moments listing (for "buy" direction)
    # ──────────────────────────────────────────────────────────

    _treasury_moments_cache = {"data": None, "ts": 0}

    @app.route('/api/treasury/moments')
    def api_treasury_moments():
        """List Jokic moments in the treasury Dapper wallet.

        Queries on-chain via Flow REST API Cadence script execution,
        enriches via local DB, caches for 60 seconds.
        Returns JSON: { moments: [...] }
        """
        import json as _json
        import base64 as _b64

        now = time.time()
        if _treasury_moments_cache["data"] and now - _treasury_moments_cache["ts"] < 60:
            return jsonify(_treasury_moments_cache["data"])

        # Execute Cadence script via Flow REST API
        treasury_addr = FLOW_ACCOUNT  # 0xf853bd09d46e7db6
        cadence_script = """
import TopShot from 0x0b2a3299cc857e29
import TopShotLocking from 0x0b2a3299cc857e29

access(all) fun main(account: Address): [[String]] {
  let acct = getAccount(account)
  let ref = acct.capabilities
    .borrow<&TopShot.Collection>(/public/MomentCollection)!
  let ids = ref.getIDs()
  var setNames: {UInt32: String} = {}
  var result: [[String]] = []
  for id in ids {
    let nft = ref.borrowMoment(id: id)!
    let sid = nft.data.setID
    if setNames[sid] == nil {
      setNames[sid] = TopShot.getSetName(setID: sid) ?? ""
    }
    let locked = TopShotLocking.isLocked(nftRef: nft)
    let subedition = TopShot.getMomentsSubedition(nftID: id) ?? 0
    result.append([
      id.toString(),
      nft.data.playID.toString(),
      setNames[sid]!,
      nft.data.serialNumber.toString(),
      locked ? "1" : "0",
      subedition.toString()
    ])
  }
  return result
}
"""
        try:
            import base64 as _b64
            cadence_b64 = _b64.b64encode(cadence_script.encode()).decode()
            addr_no_prefix = treasury_addr.removeprefix('0x')
            # Encode Address argument in JSON-CDC format
            arg_json = _json.dumps({"type": "Address", "value": "0x" + addr_no_prefix})
            arg_b64 = _b64.b64encode(arg_json.encode()).decode()

            resp = http_requests.post(
                'https://rest-mainnet.onflow.org/v1/scripts',
                json={
                    'script': cadence_b64,
                    'arguments': [arg_b64],
                },
                timeout=30,
            )
            if resp.status_code != 200:
                return jsonify({'error': f'Flow script failed (HTTP {resp.status_code})'}), 502

            # Response is base64-encoded JSON-CDC
            result_b64 = resp.text.strip().strip('"')
            result_json = _json.loads(_b64.b64decode(result_b64).decode())

            # Parse JSON-CDC array of arrays of strings
            raw_moments = []
            for item in result_json.get('value', []):
                arr = [f['value'] for f in item.get('value', [])]
                if len(arr) >= 6:
                    raw_moments.append({
                        'id': int(arr[0]),
                        'playID': int(arr[1]),
                        'setName': arr[2],
                        'serial': int(arr[3]),
                        'isLocked': arr[4] == '1',
                        'subedition': int(arr[5]),
                    })
        except Exception as e:
            return jsonify({'error': f'Failed to query treasury moments: {str(e)}'}), 502

        # Filter out locked moments
        unlocked = [m for m in raw_moments if not m.get('isLocked')]

        # Enrich via DB lookup (same as moment-lookup endpoint)
        db = get_db()
        cur = db.cursor()
        enriched = []
        for m in unlocked:
            play_id = m['playID']
            set_name = m.get('setName', '')
            subedition = m.get('subedition', 0)
            edition_suffix = '+' + str(subedition)

            cur.execute(
                prepare_query(
                    "SELECT edition_id, tier, set_name, series_number, "
                    "play_headline, play_category, team, date_of_moment, "
                    "nba_season, jersey_number, image_url, video_url, "
                    "circulation_count, low_ask "
                    "FROM jokic_editions WHERE play_flow_id = ? AND set_name = ? "
                    "ORDER BY CASE WHEN edition_id LIKE ? THEN 0 ELSE 1 END "
                    "LIMIT 1"
                ),
                (int(play_id), set_name, '%' + edition_suffix),
            )
            row = cur.fetchone()

            # Fallback: match by play_flow_id only
            if not row:
                cur.execute(
                    prepare_query(
                        "SELECT edition_id, tier, set_name, series_number, "
                        "play_headline, play_category, team, date_of_moment, "
                        "nba_season, jersey_number, image_url, video_url, "
                        "circulation_count, low_ask "
                        "FROM jokic_editions WHERE play_flow_id = ? "
                        "ORDER BY CASE WHEN edition_id LIKE ? THEN 0 ELSE 1 END "
                        "LIMIT 1"
                    ),
                    (int(play_id), '%' + edition_suffix),
                )
                row = cur.fetchone()

            if not row:
                continue

            tier = row[1] or 'COMMON'
            mvp_cost = _BUY_MVP_RATES.get(tier, 0)
            enriched.append({
                'id': m['id'],
                'serial': m['serial'],
                'editionId': row[0],
                'tier': tier,
                'setName': row[2] or '',
                'seriesNumber': row[3],
                'headline': row[4] or '',
                'player': 'Nikola Jokić',
                'team': row[6] or '',
                'imageUrl': row[10] or None,
                'mvpCost': mvp_cost,
                'subedition': m.get('subedition', 0),
            })

        result_data = {'moments': enriched}
        _treasury_moments_cache["data"] = result_data
        _treasury_moments_cache["ts"] = now
        return jsonify(result_data)

    # ──────────────────────────────────────────────────────────
    #  Swap buy endpoint: $MVP → moments
    # ──────────────────────────────────────────────────────────

    @app.route('/api/swap/buy', methods=['POST'])
    def api_swap_buy():
        """Verify $MVP transfer tx on-chain and send moments from treasury.

        Expects JSON: { txId, userAddr, userDapperAddr, momentIds }
        Returns JSON: { momentsTxId }

        Security:
        1. Replay protection – rejects txId already in completed_swaps.
        2. On-chain verification – confirms PetJokicsHorses Deposit events
           prove the claimed $MVP arrived at the treasury address.
        3. Verifies the $MVP amount matches the cost of requested moments.
        4. Only then sends moments from treasury Dapper child to user.
        """
        import asyncio
        import json as _json
        import base64 as _b64

        data = request.get_json(force=True) or {}
        tx_id = data.get('txId', '').strip()
        user_addr = data.get('userAddr', '').strip()
        user_dapper = data.get('userDapperAddr', '').strip()
        moment_ids = data.get('momentIds', [])

        if not tx_id or not user_addr or not user_dapper or not moment_ids:
            return jsonify({'error': 'Missing txId, userAddr, userDapperAddr, or momentIds'}), 400

        # --- 0. Replay protection ---
        db = get_db()
        cur = db.cursor()
        cur.execute(
            prepare_query("SELECT tx_id FROM completed_swaps WHERE tx_id = ?"),
            (tx_id,),
        )
        if cur.fetchone():
            return jsonify({'error': 'This transaction has already been processed'}), 409

        # --- 1. Calculate expected $MVP cost for requested moments ---
        total_cost = 0
        tier_counts = {}
        for mid in moment_ids:
            tier = _get_moment_tier(mid)
            if tier is None:
                return jsonify({'error': f'Could not fetch tier for moment {mid}'}), 502
            rate = _BUY_MVP_RATES.get(tier, 0)
            if rate == 0:
                return jsonify({'error': f'Moment {mid} has unsupported tier: {tier}'}), 400
            total_cost += rate
            tier_counts[tier] = tier_counts.get(tier, 0) + 1

        if total_cost <= 0:
            return jsonify({'error': 'No $MVP value for selected moments'}), 400

        # --- 2. On-chain verification: $MVP deposited to treasury ---
        treasury_mvp_addr = FLOW_SWAP_ACCOUNT.removeprefix('0x').lower()
        try:
            flow_resp = http_requests.get(
                f'https://rest-mainnet.onflow.org/v1/transaction_results/{tx_id}',
                timeout=15,
            )
            if flow_resp.status_code != 200:
                return jsonify({'error': f'Could not fetch tx result from Flow (HTTP {flow_resp.status_code})'}), 502
            tx_result = flow_resp.json()
        except Exception as e:
            return jsonify({'error': f'Flow API error: {str(e)}'}), 502

        tx_status = tx_result.get('status', '').upper()
        if tx_status != 'SEALED':
            return jsonify({'error': f'Transaction not sealed (status: {tx_status})'}), 400
        if tx_result.get('error_message'):
            return jsonify({'error': f'Transaction failed on-chain: {tx_result["error_message"]}'}), 400

        # Verify the transaction was proposed by the claiming user
        try:
            tx_body_resp = http_requests.get(
                f'https://rest-mainnet.onflow.org/v1/transactions/{tx_id}',
                timeout=10,
            )
            if tx_body_resp.status_code == 200:
                tx_body = tx_body_resp.json()
                proposer = tx_body.get('proposer', '').removeprefix('0x').lower()
                claimed = user_addr.removeprefix('0x').lower()
                if proposer and proposer != claimed:
                    return jsonify({'error': 'Transaction proposer does not match your wallet'}), 403
        except Exception:
            pass  # non-fatal — deposit event verification is the primary guard

        # Look for FungibleToken.Deposited event with PetJokicsHorses vault → treasury
        # Cadence 1.0 emits generic FungibleToken.Deposited with a "type" field
        # identifying the vault, e.g. "A.6fd2465f3a22e34c.PetJokicsHorses.Vault"
        ft_deposited_type = 'A.f233dcee88fe0abe.FungibleToken.Deposited'
        deposited_amount = 0.0
        for ev in tx_result.get('events', []):
            if ev.get('type') != ft_deposited_type:
                continue
            try:
                payload = _json.loads(_b64.b64decode(ev['payload']).decode('utf-8'))
                fields = payload.get('value', {}).get('fields', [])
                ev_vault_type = None
                ev_amount = None
                ev_to = None
                for f in fields:
                    if f.get('name') == 'type':
                        ev_vault_type = f.get('value', {}).get('value', '')
                    elif f.get('name') == 'amount':
                        ev_amount = float(f['value']['value'])
                    elif f.get('name') == 'to':
                        val = f.get('value', {})
                        if val.get('type') == 'Optional' and val.get('value'):
                            ev_to = val['value'].get('value', '').removeprefix('0x').lower()
                        elif val.get('value'):
                            ev_to = str(val['value']).removeprefix('0x').lower()
                # Must be a PetJokicsHorses vault deposit to treasury address
                if (ev_vault_type and 'PetJokicsHorses' in ev_vault_type
                        and ev_amount and ev_to == treasury_mvp_addr):
                    deposited_amount += ev_amount
            except Exception:
                continue

        # Allow small floating-point tolerance
        if deposited_amount < total_cost - 0.001:
            return jsonify({
                'error': f'Insufficient $MVP deposited. Expected {total_cost}, got {deposited_amount:.4f}',
            }), 400

        # --- 3. Send moments from treasury Dapper → user Dapper ---
        moments_tx_id = None
        if not FLOW_SWAP_PRIVATE_KEY:
            note = 'Treasury key not configured; moments will be sent manually.'
        else:
            try:
                moments_tx_id = asyncio.run(
                    _send_moments_from_treasury(user_dapper, moment_ids)
                )
                note = None
            except Exception as e:
                return jsonify({'error': f'Failed to send moments: {str(e)}'}), 500

        # --- 4. Record completed swap ---
        cur.execute(
            prepare_query(
                "INSERT INTO completed_swaps "
                "(tx_id, user_addr, moment_ids, mvp_amount, mvp_tx_id, completed_at, points) "
                "VALUES (?, ?, ?, ?, ?, ?, ?) "
                "ON CONFLICT DO NOTHING"
            ),
            (tx_id, user_addr, ','.join(str(m) for m in moment_ids),
             -total_cost, moments_tx_id, int(time.time()), 0),
        )
        db.commit()

        # Invalidate treasury moments cache
        _treasury_moments_cache["data"] = None

        result = {
            'momentsTxId': moments_tx_id,
            'mvpAmount': total_cost,
            'tierCounts': tier_counts,
        }
        if note:
            result['note'] = note

        # --- 5. Discord notification ---
        _notify_buy_discord(app, user_addr, moment_ids, total_cost, tier_counts, tx_id, moments_tx_id)

        return jsonify(result), 200

    return app


# ─── Swap helpers (module-level) ────────────────────────────────

def _get_moment_tier(moment_id):
    """Look up moment tier from local DB, fallback to TopShot GraphQL."""
    # --- Try local DB first ---
    try:
        from db.connection import get_db as _get_flask_db
        db = _get_flask_db()
        cur = db.cursor()
        cur.execute(
            prepare_query("SELECT tier FROM jokic_moments WHERE moment_id = ?"),
            (int(moment_id),),
        )
        row = cur.fetchone()
        if row:
            return row[0]
    except Exception:
        pass  # outside Flask request context or table missing

    # --- Fallback: TopShot GraphQL ---
    query = """
    query GetMintedMoment($momentId: ID!) {
      getMintedMoment(momentId: $momentId) {
        data { tier }
      }
    }
    """
    try:
        resp = http_requests.post(
            'https://public-api.nbatopshot.com/graphql',
            json={'query': query, 'variables': {'momentId': str(moment_id)}},
            headers={'User-Agent': 'MVPonFlow', 'Content-Type': 'application/json'},
            timeout=10,
        )
        data = resp.json()
        raw = data['data']['getMintedMoment']['data']['tier']
        return raw.replace('MOMENT_TIER_', '')
    except Exception:
        return None


async def _send_mvp_from_treasury(recipient_addr: str, amount: float) -> str:
    """Build, sign, and submit a $MVP transfer tx from the treasury wallet.

    Returns the Flow transaction ID hex string.
    """
    import asyncio
    from flow_py_sdk import (
        flow_client, Tx, ProposalKey, InMemorySigner, SignAlgo,
    )
    from flow_py_sdk.signer import HashAlgo
    from flow_py_sdk.cadence import Address, UFix64

    cadence_code = """
    import FungibleToken from 0xf233dcee88fe0abe
    import PetJokicsHorses from 0x6fd2465f3a22e34c

    transaction(amount: UFix64, recipient: Address) {
      let sentVault: @{FungibleToken.Vault}

      prepare(signer: auth(Storage, BorrowValue) &Account) {
        let vaultRef = signer.storage.borrow<auth(FungibleToken.Withdraw) &PetJokicsHorses.Vault>(
          from: /storage/PetJokicsHorsesVault
        ) ?? panic("Could not borrow reference to the owner's Vault!")
        self.sentVault <- vaultRef.withdraw(amount: amount)
      }

      execute {
        let recipientAccount = getAccount(recipient)
        let receiverRef = recipientAccount.capabilities.borrow<&{FungibleToken.Vault}>(
          /public/PetJokicsHorsesReceiver
        ) ?? panic("Recipient is missing receiver capability")
        receiverRef.deposit(from: <-self.sentVault)
      }
    }
    """

    treasury_addr = Address.from_hex(FLOW_SWAP_ACCOUNT.removeprefix('0x'))
    recipient = Address.from_hex(recipient_addr.removeprefix('0x'))

    # Format amount as UFix64 (8-decimal fixed point, scale by 10^8)
    ufix_amount = UFix64(int(amount * 100_000_000))

    signer = InMemorySigner(
        hash_algo=HashAlgo.SHA3_256,
        sign_algo=SignAlgo.ECDSA_P256,
        private_key_hex=FLOW_SWAP_PRIVATE_KEY,
    )

    async with flow_client(
        host='access.mainnet.nodes.onflow.org',
        port=9000,
    ) as client:
        # Get latest block for reference
        block = await client.get_latest_block()
        ref_block_id = block.id

        # Get account to read sequence number
        account = await client.get_account(address=treasury_addr.bytes)
        seq_number = account.keys[FLOW_SWAP_KEY_INDEX].sequence_number

        tx = (
            Tx(
                code=cadence_code,
                reference_block_id=ref_block_id,
                payer=treasury_addr,
                proposal_key=ProposalKey(
                    key_address=treasury_addr,
                    key_id=FLOW_SWAP_KEY_INDEX,
                    key_sequence_number=seq_number,
                ),
            )
            .add_arguments(ufix_amount, recipient)
            .add_authorizers(treasury_addr)
            .with_gas_limit(9999)
            .with_envelope_signature(
                treasury_addr, FLOW_SWAP_KEY_INDEX, signer
            )
        )

        response = await client.send_transaction(transaction=tx.to_signed_grpc())
        tx_id = response.id.hex()

        # Wait for seal (poll up to ~30s)
        for _ in range(30):
            result = await client.get_transaction_result(id=response.id)
            status_val = result.status.value if hasattr(result.status, 'value') else int(result.status)
            if status_val >= 4:  # SEALED
                if result.error_message:
                    raise RuntimeError(f'Transaction failed: {result.error_message}')
                return tx_id
            await asyncio.sleep(1)

        return tx_id  # Return even if not yet sealed


async def _send_moments_from_treasury(recipient_dapper: str, moment_ids: list) -> str:
    """Transfer TopShot moments from treasury Dapper child to recipient.

    Uses HybridCustody: the treasury Flow wallet (FLOW_SWAP_ACCOUNT) is the
    parent of the treasury Dapper wallet (FLOW_ACCOUNT).  The server signs
    the transaction using FLOW_SWAP_PRIVATE_KEY.

    Returns the Flow transaction ID hex string.
    """
    import asyncio
    from flow_py_sdk import (
        flow_client, Tx, ProposalKey, InMemorySigner, SignAlgo,
    )
    from flow_py_sdk.signer import HashAlgo
    from flow_py_sdk.cadence import Address, Array, UInt64

    child_addr = FLOW_ACCOUNT.removeprefix('0x')

    cadence_code = f"""
import HybridCustody from 0xd8a7e05a7ac670c0
import NonFungibleToken from 0x1d7e57aa55817448
import TopShot from 0x0b2a3299cc857e29

transaction(momentIds: [UInt64], recipient: Address) {{

  let nfts: @[TopShot.NFT]

  prepare(signer: auth(Storage, Capabilities) &Account) {{

    pre {{
      momentIds.length > 0   : "No moment IDs supplied."
      momentIds.length <= 120: "Cannot transfer more than 120 moments at once."
    }}

    let mgr = signer.storage.borrow<auth(HybridCustody.Manage) &HybridCustody.Manager>(
      from: HybridCustody.ManagerStoragePath
    ) ?? panic("No HybridCustody manager")

    let childAcct = mgr.borrowAccount(addr: 0x{child_addr})
      ?? panic("Child account not found")

    let capType = Type<
      auth(NonFungibleToken.Withdraw)
      &{{NonFungibleToken.Provider, NonFungibleToken.CollectionPublic}}>()

    let controllerID = childAcct.getControllerIDForType(
      type: capType,
      forPath: /storage/MomentCollection
    ) ?? panic("Controller ID not found for TopShot collection on child")

    let cap = childAcct.getCapability(
      controllerID: controllerID,
      type: capType
    ) as! Capability<
      auth(NonFungibleToken.Withdraw)
      &{{NonFungibleToken.Provider, NonFungibleToken.CollectionPublic}}>

    assert(cap.check(), message: "Invalid provider capability")
    let provider = cap.borrow()!

    self.nfts <- [] as @[TopShot.NFT]
    for id in momentIds {{
      let nft <- provider.withdraw(withdrawID: id) as! @TopShot.NFT
      self.nfts.append(<- nft)
    }}
  }}

  execute {{
    let recipientAcct = getAccount(recipient)
    let receiver = recipientAcct.capabilities
      .borrow<&{{NonFungibleToken.Receiver}}>(/public/MomentCollection)
      ?? panic("Recipient has no TopShot collection")

    while self.nfts.length > 0 {{
      receiver.deposit(token: <- self.nfts.removeFirst())
    }}
    destroy self.nfts
  }}
}}
"""

    treasury_addr = Address.from_hex(FLOW_SWAP_ACCOUNT.removeprefix('0x'))
    recipient = Address.from_hex(recipient_dapper.removeprefix('0x'))

    # Build moment IDs as UInt64 array
    moment_args = Array([UInt64(int(mid)) for mid in moment_ids])

    signer = InMemorySigner(
        hash_algo=HashAlgo.SHA3_256,
        sign_algo=SignAlgo.ECDSA_P256,
        private_key_hex=FLOW_SWAP_PRIVATE_KEY,
    )

    async with flow_client(
        host='access.mainnet.nodes.onflow.org',
        port=9000,
    ) as client:
        block = await client.get_latest_block()
        ref_block_id = block.id

        account = await client.get_account(address=treasury_addr.bytes)
        seq_number = account.keys[FLOW_SWAP_KEY_INDEX].sequence_number

        tx = (
            Tx(
                code=cadence_code,
                reference_block_id=ref_block_id,
                payer=treasury_addr,
                proposal_key=ProposalKey(
                    key_address=treasury_addr,
                    key_id=FLOW_SWAP_KEY_INDEX,
                    key_sequence_number=seq_number,
                ),
            )
            .add_arguments(moment_args, recipient)
            .add_authorizers(treasury_addr)
            .with_gas_limit(9999)
            .with_envelope_signature(
                treasury_addr, FLOW_SWAP_KEY_INDEX, signer
            )
        )

        response = await client.send_transaction(transaction=tx.to_signed_grpc())
        tx_id = response.id.hex()

        # Wait for seal (poll up to ~30s)
        for _ in range(30):
            result = await client.get_transaction_result(id=response.id)
            status_val = result.status.value if hasattr(result.status, 'value') else int(result.status)
            if status_val >= 4:  # SEALED
                if result.error_message:
                    raise RuntimeError(f'Transaction failed: {result.error_message}')
                return tx_id
            await asyncio.sleep(1)

        return tx_id  # Return even if not yet sealed


def get_db():
    """Get database connection for Flask requests."""
    from db.connection import get_db as get_db_func
    return get_db_func()


def _notify_swap_discord(app, user_addr, moment_ids, total_mvp, tier_counts, tx_id, mvp_tx_id, boost_applied=False):
    """Fire-and-forget Discord notification for a completed swap."""
    import asyncio as _aio

    bot = getattr(app, 'discord_bot', None)
    channel_id = getattr(app, 'swap_notify_channel_id', None)
    if not bot or not channel_id or not bot.is_ready():
        return

    # Build tier summary  e.g. "2 Common, 1 Rare"
    tier_parts = []
    for tier, count in sorted(tier_counts.items()):
        tier_parts.append(f"{count} {tier.capitalize()}")
    tier_summary = ', '.join(tier_parts) if tier_parts else f"{len(moment_ids)} moment(s)"

    # Resolve TopShot username (best-effort)
    try:
        ts_username = get_ts_username_from_flow_wallet(user_addr)
    except Exception:
        ts_username = None

    if ts_username:
        user_display = f"[{ts_username}](https://www.nbatopshot.com/user/{ts_username})"
    else:
        short_addr = f"{user_addr[:6]}…{user_addr[-4:]}" if len(user_addr) > 10 else user_addr
        user_display = f"**{short_addr}**"

    flowdiver_tx = f"https://www.flowdiver.io/tx/{tx_id}"
    mvp_tx_link = f"  |  [$MVP tx](https://www.flowdiver.io/tx/{mvp_tx_id})" if mvp_tx_id else ""

    embed_description = (
        f"{user_display} swapped **{len(moment_ids)}** moment{'s' if len(moment_ids) != 1 else ''} "
        f"({tier_summary}) for **{total_mvp:,.1f} $MVP**"
        f"{' 🐎 **+20% Horse Boost**' if boost_applied else ''}\n\n"
        f"[View tx]({flowdiver_tx}){mvp_tx_link}"
    )

    async def _send():
        try:
            channel = bot.get_channel(channel_id)
            if not channel:
                channel = await bot.fetch_channel(channel_id)
            if channel:
                import discord
                embed = discord.Embed(
                    title="⇅ Moment Swap Completed",
                    description=embed_description,
                    color=0xFDB927,
                )
                embed.set_footer(text="MVP on Flow • Swap")
                await channel.send(embed=embed)
        except Exception:
            pass  # best-effort, don't break the API response

    # Schedule on the bot's event loop (runs in the Discord thread)
    try:
        bot.loop.call_soon_threadsafe(_aio.ensure_future, _send())
    except Exception:
        pass


def _notify_buy_discord(app, user_addr, moment_ids, total_mvp, tier_counts, tx_id, moments_tx_id):
    """Fire-and-forget Discord notification for a buy swap ($MVP → moments)."""
    import asyncio as _aio

    bot = getattr(app, 'discord_bot', None)
    channel_id = getattr(app, 'swap_notify_channel_id', None)
    if not bot or not channel_id or not bot.is_ready():
        return

    tier_parts = []
    for tier, count in sorted(tier_counts.items()):
        tier_parts.append(f"{count} {tier.capitalize()}")
    tier_summary = ', '.join(tier_parts) if tier_parts else f"{len(moment_ids)} moment(s)"

    try:
        ts_username = get_ts_username_from_flow_wallet(user_addr)
    except Exception:
        ts_username = None

    if ts_username:
        user_display = f"[{ts_username}](https://www.nbatopshot.com/user/{ts_username})"
    else:
        short_addr = f"{user_addr[:6]}…{user_addr[-4:]}" if len(user_addr) > 10 else user_addr
        user_display = f"**{short_addr}**"

    flowdiver_tx = f"https://www.flowdiver.io/tx/{tx_id}"
    moments_link = f"  |  [Moments tx](https://www.flowdiver.io/tx/{moments_tx_id})" if moments_tx_id else ""

    embed_description = (
        f"{user_display} bought **{len(moment_ids)}** moment{'s' if len(moment_ids) != 1 else ''} "
        f"({tier_summary}) for **{total_mvp:,.1f} $MVP**\n\n"
        f"[View $MVP tx]({flowdiver_tx}){moments_link}"
    )

    async def _send():
        try:
            channel = bot.get_channel(channel_id)
            if not channel:
                channel = await bot.fetch_channel(channel_id)
            if channel:
                import discord
                embed = discord.Embed(
                    title="🛒 Moment Purchase Completed",
                    description=embed_description,
                    color=0x4ade80,
                )
                embed.set_footer(text="MVP on Flow • Swap")
                await channel.send(embed=embed)
        except Exception:
            pass

    try:
        bot.loop.call_soon_threadsafe(_aio.ensure_future, _send())
    except Exception:
        pass


import os
