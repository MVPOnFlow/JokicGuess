"""Background poller for Fastbreak Bracket tournaments.

Polls every POLL_INTERVAL seconds and for each active tournament:
 - Fetches live FastBreak scores and updates matchup rows (live projection)
 - Creates/updates PROJECTED matchups for the next round
 - Auto-advances the round when the FastBreak finishes

Also auto-generates brackets for SIGNUP tournaments whose deadline has passed.
"""

import threading
import time
import logging
import json
import math
import random
import datetime

from db.init import get_db_connection
from utils.helpers import (
    prepare_query,
    extract_fastbreak_runs,
    get_rank_and_lineup_for_user,
)

logger = logging.getLogger(__name__)

POLL_INTERVAL = 600  # 10 minutes


# ── Helpers ──────────────────────────────────────────────────────────

def _fetch_fb_status_map():
    """Call TopShot API once and return {fastbreak_id: status} dict."""
    try:
        runs = extract_fastbreak_runs()
        out = {}
        for run in runs:
            for fb in (run.get("fastBreaks") or []):
                if fb and fb.get("id"):
                    out[fb["id"]] = fb.get("status")
        return out
    except Exception as e:
        logger.warning("[Bracket] fetch FB status map failed: %s", e)
        return {}


def _fb_data_for_user(username, fastbreak_id):
    """Fetch rank/points/lineup for one user from TopShot."""
    if not username:
        return {}
    try:
        return get_rank_and_lineup_for_user(username, fastbreak_id) or {}
    except Exception:
        return {}


# ── Auto-generate bracket ───────────────────────────────────────────

def _auto_generate(conn, db_type, tid):
    """Generate first-round bracket when signup deadline passes.

    Same logic as ``POST /api/bracket/tournament/<tid>/generate`` but
    invoked automatically by the poller.
    """
    cursor = conn.cursor()

    cursor.execute(prepare_query(
        "SELECT id, wallet_address, ts_username "
        "FROM bracket_participants WHERE tournament_id = ?"
    ), (tid,))
    parts = cursor.fetchall()
    if len(parts) < 2:
        logger.info("[Bracket] Tournament %d has < 2 participants – skipping auto-generate", tid)
        return

    plist = [(p[0], p[1], p[2]) for p in parts]
    random.shuffle(plist)
    for idx, (pid, _w, _u) in enumerate(plist):
        cursor.execute(prepare_query(
            "UPDATE bracket_participants SET seed_number = ? WHERE id = ?"
        ), (idx + 1, pid))

    n = len(plist)
    total_rounds = math.ceil(math.log2(n))
    bracket_size = 2 ** total_rounds
    num_byes = bracket_size - n

    match_idx = 0
    i = 0
    while i < n:
        p1_wallet = plist[i][1]
        if num_byes > 0:
            cursor.execute(prepare_query(
                "INSERT INTO bracket_matchups "
                "(tournament_id, round_number, match_index, player1_wallet, "
                "player2_wallet, winner_wallet, status) "
                "VALUES (?, 1, ?, ?, NULL, ?, 'BYE')"
            ), (tid, match_idx, p1_wallet, p1_wallet))
            num_byes -= 1
            i += 1
        else:
            p2_wallet = plist[i + 1][1] if i + 1 < n else None
            cursor.execute(prepare_query(
                "INSERT INTO bracket_matchups "
                "(tournament_id, round_number, match_index, player1_wallet, "
                "player2_wallet, status) "
                "VALUES (?, 1, ?, ?, ?, 'PENDING')"
            ), (tid, match_idx, p1_wallet, p2_wallet))
            i += 2
        match_idx += 1

    cursor.execute(prepare_query(
        "UPDATE bracket_tournaments SET status = 'ACTIVE', current_round = 1 WHERE id = ?"
    ), (tid,))
    conn.commit()
    logger.info(
        "[Bracket] Auto-generated bracket for tournament %d (%d players, %d rounds)",
        tid, n, total_rounds,
    )


# ── Tiebreaker helpers ───────────────────────────────────────────────

def _get_cumulative_score(cursor, tid, wallet):
    """Sum of a player's scores from all COMPLETE and BYE matchups in this tournament.

    Used as the primary tiebreaker when two players tie in the current round.
    BYE matchups are included so players who received a first-round bye
    still accumulate points for tiebreaker purposes.
    """
    cursor.execute(prepare_query(
        "SELECT COALESCE(SUM(CASE "
        "WHEN player1_wallet = ? THEN player1_score "
        "WHEN player2_wallet = ? THEN player2_score "
        "ELSE 0 END), 0) "
        "FROM bracket_matchups "
        "WHERE tournament_id = ? AND status IN ('COMPLETE', 'BYE')"
    ), (wallet, wallet, tid))
    return cursor.fetchone()[0] or 0


def _resolve_winner(cursor, tid, p1, p2, s1, s2):
    """Decide the winner of a matchup, applying tiebreakers.

    Priority:
      1. Higher Fastbreak score wins.
      2. If tied: higher cumulative tournament points wins.
      3. If still tied: higher seed (player 1) wins.
    """
    if s1 is not None and s2 is not None:
        if s1 != s2:
            return (p1, p2) if s1 > s2 else (p2, p1)
        # Tiebreaker #1: cumulative tournament points
        cum1 = _get_cumulative_score(cursor, tid, p1) + s1
        cum2 = _get_cumulative_score(cursor, tid, p2) + s2
        if cum1 != cum2:
            return (p1, p2) if cum1 > cum2 else (p2, p1)
        # Tiebreaker #2: higher seed (p1 is always the higher seed)
        return (p1, p2)
    elif s1 is not None:
        return (p1, p2)
    elif s2 is not None:
        return (p2, p1)
    else:
        return (p1, p2)  # no scores — higher seed wins


# ── BYE score backfill ─────────────────────────────────────────────

def _backfill_bye_scores(conn, db_type, tid, round_number, fastbreak_id):
    """Fetch Fastbreak scores for BYE winners who don't have a score yet.

    BYE matchups are created without scores. This back-fills the winner's
    score/rank/lineup so their points count in cumulative tiebreakers.
    """
    cursor = conn.cursor()

    # wallet → username mapping
    cursor.execute(prepare_query(
        "SELECT wallet_address, ts_username "
        "FROM bracket_participants WHERE tournament_id = ?"
    ), (tid,))
    wallet_to_username = {r[0]: r[1] for r in cursor.fetchall()}

    # BYE matchups with missing scores in this round
    cursor.execute(prepare_query(
        "SELECT id, player1_wallet FROM bracket_matchups "
        "WHERE tournament_id = ? AND round_number = ? AND status = 'BYE' "
        "AND player1_score IS NULL"
    ), (tid, round_number))
    byes = cursor.fetchall()

    updated = 0
    for matchup_id, p1 in byes:
        d1 = _fb_data_for_user(wallet_to_username.get(p1), fastbreak_id) if p1 else {}
        ln1 = json.dumps(d1["players"]) if d1.get("players") else None

        cursor.execute(prepare_query(
            "UPDATE bracket_matchups "
            "SET player1_score = ?, player1_rank = ?, player1_lineup = ?, "
            "    fastbreak_id = ? "
            "WHERE id = ?"
        ), (d1.get("points"), d1.get("rank"), ln1, fastbreak_id, matchup_id))
        updated += 1

    if updated:
        conn.commit()
        logger.debug(
            "[Bracket] Back-filled scores for %d BYE matchups (tournament %d, round %d)",
            updated, tid, round_number,
        )
    return updated


# ── Live score update ───────────────────────────────────────────────

def _update_live_scores(conn, db_type, tid, current_round, fastbreak_id):
    """Fetch current scores from TopShot and update PENDING matchup rows.

    This stores live scores/ranks/lineups on the matchup without changing
    its status, so the frontend can show in-progress projections.
    """
    cursor = conn.cursor()

    # wallet → username mapping
    cursor.execute(prepare_query(
        "SELECT wallet_address, ts_username "
        "FROM bracket_participants WHERE tournament_id = ?"
    ), (tid,))
    wallet_to_username = {r[0]: r[1] for r in cursor.fetchall()}

    # Pending matchups in current round
    cursor.execute(prepare_query(
        "SELECT id, player1_wallet, player2_wallet "
        "FROM bracket_matchups "
        "WHERE tournament_id = ? AND round_number = ? AND status = 'PENDING'"
    ), (tid, current_round))
    pending = cursor.fetchall()

    updated = 0
    for matchup_id, p1, p2 in pending:
        d1 = _fb_data_for_user(wallet_to_username.get(p1), fastbreak_id) if p1 else {}
        d2 = _fb_data_for_user(wallet_to_username.get(p2), fastbreak_id) if p2 else {}

        ln1 = json.dumps(d1["players"]) if d1.get("players") else None
        ln2 = json.dumps(d2["players"]) if d2.get("players") else None

        cursor.execute(prepare_query(
            "UPDATE bracket_matchups "
            "SET player1_score = ?, player2_score = ?, "
            "    player1_rank  = ?, player2_rank  = ?, "
            "    player1_lineup = ?, player2_lineup = ?, "
            "    fastbreak_id = ? "
            "WHERE id = ?"
        ), (
            d1.get("points"), d2.get("points"),
            d1.get("rank"),   d2.get("rank"),
            ln1, ln2,
            fastbreak_id, matchup_id,
        ))
        updated += 1

    conn.commit()
    return updated


# ── Projected next-round matchups ───────────────────────────────────

def _update_projected_matchups(conn, db_type, tid, current_round, total_rounds):
    """Create / replace PROJECTED matchups for the next round.

    Based on current scores in PENDING matchups plus already-resolved
    COMPLETE / BYE matchups, project who would advance and show the
    next-round bracket.
    """
    if current_round >= total_rounds:
        return  # finals — nothing to project

    cursor = conn.cursor()
    next_round = current_round + 1

    # Don't overwrite real matchups if they already exist for next round
    cursor.execute(prepare_query(
        "SELECT COUNT(*) FROM bracket_matchups "
        "WHERE tournament_id = ? AND round_number = ? AND status != 'PROJECTED'"
    ), (tid, next_round))
    if cursor.fetchone()[0] > 0:
        return

    # Remove old projections
    cursor.execute(prepare_query(
        "DELETE FROM bracket_matchups "
        "WHERE tournament_id = ? AND round_number = ? AND status = 'PROJECTED'"
    ), (tid, next_round))

    # Gather projected winners from current round
    cursor.execute(prepare_query(
        "SELECT player1_wallet, player2_wallet, player1_score, player2_score, "
        "       status, winner_wallet "
        "FROM bracket_matchups "
        "WHERE tournament_id = ? AND round_number = ? AND status != 'PROJECTED' "
        "ORDER BY match_index ASC"
    ), (tid, current_round))

    projected_winners = []
    for p1, p2, s1, s2, status, winner in cursor.fetchall():
        if status in ("COMPLETE", "BYE"):
            projected_winners.append(winner)
        elif status == "PENDING":
            # Project based on current live scores (with tiebreaker)
            proj_winner, _ = _resolve_winner(cursor, tid, p1, p2, s1, s2)
            projected_winners.append(proj_winner)

    if not projected_winners:
        conn.commit()
        return

    for mi in range(0, len(projected_winners), 2):
        p1 = projected_winners[mi]
        p2 = projected_winners[mi + 1] if mi + 1 < len(projected_winners) else None
        cursor.execute(prepare_query(
            "INSERT INTO bracket_matchups "
            "(tournament_id, round_number, match_index, player1_wallet, "
            "player2_wallet, status) "
            "VALUES (?, ?, ?, ?, ?, 'PROJECTED')"
        ), (tid, next_round, mi // 2, p1, p2))

    conn.commit()


# ── Finalize round and advance ──────────────────────────────────────

def _finalize_round(conn, db_type, tid, current_round, fastbreak_id):
    """Determine winners from stored scores, mark losers eliminated, advance.

    Scores should already be up-to-date from ``_update_live_scores``.
    """
    cursor = conn.cursor()

    cursor.execute(prepare_query(
        "SELECT id, player1_wallet, player2_wallet, "
        "       player1_score, player2_score "
        "FROM bracket_matchups "
        "WHERE tournament_id = ? AND round_number = ? AND status = 'PENDING'"
    ), (tid, current_round))
    pending = cursor.fetchall()

    if not pending:
        return

    winners = []
    for mid, p1, p2, s1, s2 in pending:
        if not p2:
            cursor.execute(prepare_query(
                "UPDATE bracket_matchups SET winner_wallet = ?, status = 'BYE' WHERE id = ?"
            ), (p1, mid))
            winners.append(p1)
            continue

        winner, loser = _resolve_winner(cursor, tid, p1, p2, s1, s2)

        cursor.execute(prepare_query(
            "UPDATE bracket_matchups SET winner_wallet = ?, status = 'COMPLETE' WHERE id = ?"
        ), (winner, mid))

        cursor.execute(prepare_query(
            "UPDATE bracket_participants SET eliminated_in_round = ? "
            "WHERE tournament_id = ? AND wallet_address = ?"
        ), (current_round, tid, loser))

        winners.append(winner)

    # Also collect BYE winners from this round
    cursor.execute(prepare_query(
        "SELECT winner_wallet FROM bracket_matchups "
        "WHERE tournament_id = ? AND round_number = ? AND status = 'BYE'"
    ), (tid, current_round))
    for r in cursor.fetchall():
        if r[0] and r[0] not in winners:
            winners.append(r[0])

    # Delete any PROJECTED matchups for next round — real ones replace them
    next_round = current_round + 1
    cursor.execute(prepare_query(
        "DELETE FROM bracket_matchups "
        "WHERE tournament_id = ? AND round_number = ? AND status = 'PROJECTED'"
    ), (tid, next_round))

    # Check if tournament is over
    if len(winners) <= 1:
        champion = winners[0] if winners else None
        cursor.execute(prepare_query(
            "UPDATE bracket_tournaments SET status = 'COMPLETE', winner_wallet = ? WHERE id = ?"
        ), (champion, tid))
        conn.commit()
        logger.info("[Bracket] Tournament %d complete! Champion: %s", tid, champion)
        return

    # Create next-round matchups
    for mi in range(0, len(winners), 2):
        p1 = winners[mi]
        p2 = winners[mi + 1] if mi + 1 < len(winners) else None
        st = "BYE" if not p2 else "PENDING"
        w = p1 if not p2 else None
        cursor.execute(prepare_query(
            "INSERT INTO bracket_matchups "
            "(tournament_id, round_number, match_index, player1_wallet, "
            "player2_wallet, winner_wallet, status) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)"
        ), (tid, next_round, mi // 2, p1, p2, w, st))

    cursor.execute(prepare_query(
        "UPDATE bracket_tournaments SET current_round = ? WHERE id = ?"
    ), (next_round, tid))
    conn.commit()
    logger.info(
        "[Bracket] Tournament %d advanced to round %d (%d winners)",
        tid, next_round, len(winners),
    )


# ── Orchestrators ───────────────────────────────────────────────────

def _poll_active_tournament(conn, db_type, tid, current_round, fb_status_map):
    """Poll a single active tournament: update scores, project, maybe advance."""
    cursor = conn.cursor()

    # Look up fastbreak_id for current round
    cursor.execute(prepare_query(
        "SELECT fastbreak_id FROM bracket_rounds "
        "WHERE tournament_id = ? AND round_number = ?"
    ), (tid, current_round))
    row = cursor.fetchone()
    if not row:
        return
    fastbreak_id = row[0]

    fb_status = fb_status_map.get(fastbreak_id)

    # Update live scores (even after FB finishes, ensures final scores are stored)
    n_updated = _update_live_scores(conn, db_type, tid, current_round, fastbreak_id)

    # Back-fill scores for BYE matchups so they count in tiebreakers
    _backfill_bye_scores(conn, db_type, tid, current_round, fastbreak_id)

    # Compute total_rounds for projection
    cursor.execute(prepare_query(
        "SELECT COUNT(*) FROM bracket_participants WHERE tournament_id = ?"
    ), (tid,))
    n_participants = cursor.fetchone()[0]
    total_rounds = math.ceil(math.log2(n_participants)) if n_participants > 1 else 1

    # Update projected next-round matchups
    _update_projected_matchups(conn, db_type, tid, current_round, total_rounds)

    # If the FastBreak is finished, finalize the round
    if fb_status == "FAST_BREAK_FINISHED":
        cursor.execute(prepare_query(
            "SELECT COUNT(*) FROM bracket_matchups "
            "WHERE tournament_id = ? AND round_number = ? AND status = 'PENDING'"
        ), (tid, current_round))
        if cursor.fetchone()[0] > 0:
            _finalize_round(conn, db_type, tid, current_round, fastbreak_id)

    if n_updated:
        logger.debug(
            "[Bracket] Updated %d matchups for tournament %d round %d (FB status: %s)",
            n_updated, tid, current_round, fb_status,
        )


def bracket_poll_tick():
    """Single poll iteration — called every POLL_INTERVAL seconds."""
    conn = None
    try:
        conn, db_type = get_db_connection()
        cursor = conn.cursor()

        # Fetch FB statuses one time for all tournaments
        fb_status_map = _fetch_fb_status_map()

        # ─ 1. Auto-generate brackets for expired signups ─
        cursor.execute(prepare_query(
            "SELECT id, signup_close_ts FROM bracket_tournaments WHERE status = 'SIGNUP'"
        ))
        signup_rows = cursor.fetchall()
        now_ts = int(datetime.datetime.now(datetime.UTC).timestamp())
        for row in signup_rows:
            tid, close_ts = row[0], int(row[1])
            if now_ts >= close_ts:
                try:
                    _auto_generate(conn, db_type, tid)
                except Exception as e:
                    logger.warning("[Bracket] Auto-generate tournament %d failed: %s", tid, e)

        # ─ 2. Poll active tournaments ─
        cursor.execute(prepare_query(
            "SELECT id, current_round FROM bracket_tournaments WHERE status = 'ACTIVE'"
        ))
        active_rows = cursor.fetchall()
        for row in active_rows:
            tid, current_round = row[0], row[1]
            try:
                _poll_active_tournament(conn, db_type, tid, current_round, fb_status_map)
            except Exception as e:
                logger.warning("[Bracket] Poll tournament %d failed: %s", tid, e)

    except Exception as e:
        logger.error("[Bracket] Poll tick error: %s", e)
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass


# ── Start / stop ────────────────────────────────────────────────────

_poller_thread = None


def start_bracket_poller(interval=POLL_INTERVAL):
    """Start the background bracket polling thread (daemon)."""
    global _poller_thread

    def _loop():
        logger.info("[Bracket] Poller started (interval=%ds)", interval)
        # Small initial delay so the app finishes booting first
        time.sleep(5)
        while True:
            bracket_poll_tick()
            time.sleep(interval)

    _poller_thread = threading.Thread(target=_loop, daemon=True, name="bracket-poller")
    _poller_thread.start()
    logger.info("[Bracket] Poller thread launched")
    return _poller_thread
