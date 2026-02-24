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
    TREASURY_DATA
)


def register_routes(app):
    """Register all Flask routes."""
    
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

        # Map wallets to usernames + attach last_scored_at
        leaderboard_data = [
            {
                "username": map_wallet_to_username(from_address),
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

    # ── Showcase helpers ────────────────────────────────────────────
    _TS_HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) "
                      "Chrome/131.0.0.0 Safari/537.36",
    }

    def _fetch_minted_moment(moment_id):
        """Scrape a moment page's __NEXT_DATA__ for full moment detail; return dict or None."""
        import json as _json
        try:
            r = http_requests.get(
                f"https://nbatopshot.com/moment/{moment_id}",
                headers=_TS_HEADERS,
                timeout=20,
            )
            r.raise_for_status()
            marker = '__NEXT_DATA__" type="application/json"'
            idx = r.text.find(marker)
            if idx < 0:
                return None
            json_start = r.text.find('>', idx + len(marker)) + 1
            json_end = r.text.find('</script>', json_start)
            nd = _json.loads(r.text[json_start:json_end])
            return nd.get("props", {}).get("pageProps", {}).get("moment")
        except Exception:
            return None

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

        return {
            "id": m.get("id"),
            "playId": play.get("id", ""),
            "tier": tier,
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

        return {
            "id": m.get("id"),
            "playId": play.get("id", ""),
            "tier": tier,
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

    return app


def get_db():
    """Get database connection for Flask requests."""
    from db.connection import get_db as get_db_func
    return get_db_func()


import os
