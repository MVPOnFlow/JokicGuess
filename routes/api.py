"""Flask API routes for JokicGuess application."""

import math
import datetime
import statistics
from flask import jsonify, send_from_directory, request, g
from concurrent.futures import ThreadPoolExecutor, as_completed
from utils.helpers import (
    prepare_query, map_wallet_to_username, 
    get_rank_and_lineup_for_user, get_flow_wallet_from_ts_username,
    get_ts_username_from_flow_wallet
)
from config import (
    SWAPFEST_START_TIME, SWAPFEST_END_TIME,
    SWAPFEST_BOOST1_CUTOFF, SWAPFEST_BOOST2_CUTOFF
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
        # Hard-coded data
        treasury_data = {
            "tokens_in_wild": 13666,
            "common_count": 2291,
            "rare_count": 109,
            "tsd_count": 0,
            "lego_count": 1,
        }

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
        treasury_data['last_updated'] = "2025-10-28 15:00 UTC"
        
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

    return app


def get_db():
    """Get database connection for Flask requests."""
    from db.connection import get_db as get_db_func
    return get_db_func()


import os
