"""
One-time script to seed bracket tournaments — a signup contest + a live active
bracket that pulls REAL Fastbreak scores from the NBA TopShot GraphQL API.
"""
import time
from db.init import get_db_connection, initialize_database
from utils.helpers import (
    extract_fastbreak_runs,
    get_rank_and_lineup_for_user,
    DAPPER_WALLET_USERNAME_MAP,
)

conn, db_type = get_db_connection()
cursor = conn.cursor()

# Ensure tables exist
initialize_database(conn, db_type)

# Drop existing data so this script is idempotent
cursor.execute("DELETE FROM bracket_matchups")
cursor.execute("DELETE FROM bracket_participants")
cursor.execute("DELETE FROM bracket_tournaments")
conn.commit()

ph = '%s' if db_type == 'postgresql' else '?'

# ── helpers ──────────────────────────────────────────────────────────
def ins_tournament(tid, name, fee, currency, close_ts, status, cur_round, winner=None):
    if db_type == 'postgresql':
        cursor.execute(
            "INSERT INTO bracket_tournaments (name, fee_amount, fee_currency, signup_close_ts, status, current_round, winner_wallet)"
            f" VALUES ({ph},{ph},{ph},{ph},{ph},{ph},{ph}) RETURNING id",
            (name, fee, currency, close_ts, status, cur_round, winner),
        )
        return cursor.fetchone()[0]
    else:
        cursor.execute(
            "INSERT INTO bracket_tournaments (id, name, fee_amount, fee_currency, signup_close_ts, status, current_round, winner_wallet)"
            f" VALUES ({ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph})",
            (tid, name, fee, currency, close_ts, status, cur_round, winner),
        )
        return tid


def ins_participant(pid, tid, wallet, username, seed, elim_round=None):
    if db_type == 'postgresql':
        cursor.execute(
            "INSERT INTO bracket_participants (tournament_id, wallet_address, ts_username, seed_number, eliminated_in_round)"
            f" VALUES ({ph},{ph},{ph},{ph},{ph})",
            (tid, wallet, username, seed, elim_round),
        )
    else:
        cursor.execute(
            "INSERT INTO bracket_participants (id, tournament_id, wallet_address, ts_username, seed_number, eliminated_in_round)"
            f" VALUES ({ph},{ph},{ph},{ph},{ph},{ph})",
            (pid, tid, wallet, username, seed, elim_round),
        )


def ins_matchup(mid, tid, rnd, idx, p1, p2, s1, s2, winner, fb_id, status,
                r1=None, r2=None, l1=None, l2=None):
    """Insert a matchup. r1/r2 = ranks, l1/l2 = lineups (JSON strings)."""
    import json as _json
    l1_str = _json.dumps(l1) if l1 else None
    l2_str = _json.dumps(l2) if l2 else None
    if db_type == 'postgresql':
        cursor.execute(
            "INSERT INTO bracket_matchups (tournament_id, round_number, match_index,"
            " player1_wallet, player2_wallet, player1_score, player2_score,"
            " player1_rank, player2_rank, player1_lineup, player2_lineup,"
            " winner_wallet, fastbreak_id, status)"
            f" VALUES ({ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph})",
            (tid, rnd, idx, p1, p2, s1, s2, r1, r2, l1_str, l2_str, winner, fb_id, status),
        )
    else:
        cursor.execute(
            "INSERT INTO bracket_matchups (id, tournament_id, round_number, match_index,"
            " player1_wallet, player2_wallet, player1_score, player2_score,"
            " player1_rank, player2_rank, player1_lineup, player2_lineup,"
            " winner_wallet, fastbreak_id, status)"
            f" VALUES ({ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph})",
            (mid, tid, rnd, idx, p1, p2, s1, s2, r1, r2, l1_str, l2_str, winner, fb_id, status),
        )


def fetch_score(username, fb_id):
    """Fetch a user's real Fastbreak data. Returns dict with rank, points, players or empty dict."""
    try:
        r = get_rank_and_lineup_for_user(username, fb_id)
        return r if r else {}
    except Exception:
        return {}


# ======================================================================
# Step 1 — Discover recent finished Classic fastbreaks
# ======================================================================
print('Fetching recent fastbreak runs from TopShot API...')
runs = extract_fastbreak_runs()
finished_classic = []
for run in runs:
    rn = run.get('runName', '')
    if not rn or rn.endswith('Pro'):
        continue
    if 'Classic' not in rn:
        continue
    for fb in (run.get('fastBreaks') or []):
        if fb and fb.get('status') == 'FAST_BREAK_FINISHED':
            finished_classic.append((fb['id'], fb['gameDate']))

finished_classic.sort(key=lambda x: x[1], reverse=True)
print(f'  Found {len(finished_classic)} finished Classic fastbreaks')

# We need 3 finished fastbreaks for rounds 1-3
# Use the 3rd, 2nd, and 1st most recent (chronological order for the bracket)
fb_round1 = finished_classic[2]  # 3rd most recent
fb_round2 = finished_classic[1]  # 2nd most recent
fb_round3 = finished_classic[0]  # most recent

print(f'  Round 1 FB: {fb_round1[1][:10]} ({fb_round1[0][:8]}...)')
print(f'  Round 2 FB: {fb_round2[1][:10]} ({fb_round2[0][:8]}...)')
print(f'  Round 3 FB: {fb_round3[1][:10]} ({fb_round3[0][:8]}...)')


# ======================================================================
# Tournament 1 — SIGNUP (upcoming)
# ======================================================================
close_ts_signup = 1774915140  # Mar 27 2026 23:59 UTC
t1 = ins_tournament(1, 'Fastbreak Bracket #1 — March Madness', 5, '$MVP', close_ts_signup, 'SIGNUP', 0)
print(f'\n[T{t1}] Signup tournament created')


# ======================================================================
# Tournament 2 — ACTIVE (live bracket, 16 players, real scores)
# ======================================================================

# 16 real wallets/usernames — all verified Classic Fastbreak players
PLAYERS = [
    ('0xd6641d89e6372ee1', 'leet3'),             # seed 1
    ('0x3845ab9cbd7f4e4b', 'Psyduck27'),          # seed 2
    ('0xdad344d00b889de2', 'td808486'),            # seed 3
    ('0x6822e275997c7132', 'superherbe'),           # seed 4
    ('0x1381915616f894fb', 'Jammerz'),              # seed 5
    ('0xcd80f4ce7a7c6000', 'NamePrime'),            # seed 6
    ('0x52ab4596ce0a9e71', 'RichDMC'),              # seed 7
    ('0x84387b2cd4617bf3', 'sutych'),               # seed 8
    ('0xf47cbab86671a23d', 'rb_duke'),              # seed 9
    ('0x525bbc8ea4a0943e', 'Coach_P0625'),          # seed 10
    ('0xff272db64671ce5f', 'Codester_3'),           # seed 11
    ('0x452be065d1ed663c', 'Kiel17'),               # seed 12
    ('0x63872cb44c7774ae', 'Nolan11'),              # seed 13
    ('0xbf3286046c76cf86', 'wildrick'),             # seed 14
    ('0x334a20bbaa7f2801', 'bobobobo'),             # seed 15
    ('0xc246d05ba775362e', 'KnotBean'),             # seed 16
]

close_ts_active = 1742860800  # already past — signup closed
t2 = ins_tournament(2, 'Fastbreak Bracket #0 — Preseason Cup', 3, '$MVP', close_ts_active, 'ACTIVE', 4)
print(f'[T{t2}] Active tournament created')

w = {p[1]: p[0] for p in PLAYERS}  # username → wallet

# Standard 16-seed bracket pairings for rounds
ROUND1_PAIRINGS = [
    ('leet3',      'KnotBean'),        # 1 vs 16
    ('sutych',     'rb_duke'),          # 8 vs 9
    ('Jammerz',    'Kiel17'),           # 5 vs 12
    ('superherbe', 'Nolan11'),          # 4 vs 13
    ('bobobobo',   'Psyduck27'),        # 15 vs 2  (seeded: 2 is higher)
    ('Coach_P0625','NamePrime'),        # 10 vs 6  (seeded: 6 is higher)
    ('Codester_3', 'RichDMC'),          # 11 vs 7
    ('wildrick',   'td808486'),         # 14 vs 3
]

# ── Fetch real Round 1 scores ───────────────────────────────────────
print(f'\nFetching Round 1 scores from {fb_round1[1][:10]}...')
r1_results = []
for p1_name, p2_name in ROUND1_PAIRINGS:
    d1 = fetch_score(p1_name, fb_round1[0])
    d2 = fetch_score(p2_name, fb_round1[0])
    s1 = d1.get('points')
    s2 = d2.get('points')
    rk1 = d1.get('rank')
    rk2 = d2.get('rank')
    ln1 = d1.get('players')
    ln2 = d2.get('players')
    # Determine winner (higher score wins, handle missing scores)
    if s1 is not None and s2 is not None:
        winner_name = p1_name if s1 >= s2 else p2_name
    elif s1 is not None:
        winner_name = p1_name
    elif s2 is not None:
        winner_name = p2_name
    else:
        winner_name = p1_name  # fallback
    r1_results.append((p1_name, p2_name, s1, s2, winner_name, rk1, rk2, ln1, ln2))
    print(f'  {p1_name:18s} {s1 or "-":>5}  vs  {s2 or "-":<5} {p2_name:18s} → {winner_name}')

# Round 2 pairings come from round 1 winners
r1_winners = [r[4] for r in r1_results]
ROUND2_PAIRINGS = [
    (r1_winners[0], r1_winners[1]),   # W(1v16) vs W(8v9)
    (r1_winners[2], r1_winners[3]),   # W(5v12) vs W(4v13)
    (r1_winners[4], r1_winners[5]),   # W(15v2) vs W(10v6)
    (r1_winners[6], r1_winners[7]),   # W(11v7) vs W(14v3)
]

print(f'\nFetching Round 2 scores from {fb_round2[1][:10]}...')
r2_results = []
for p1_name, p2_name in ROUND2_PAIRINGS:
    d1 = fetch_score(p1_name, fb_round2[0])
    d2 = fetch_score(p2_name, fb_round2[0])
    s1 = d1.get('points')
    s2 = d2.get('points')
    rk1 = d1.get('rank')
    rk2 = d2.get('rank')
    ln1 = d1.get('players')
    ln2 = d2.get('players')
    if s1 is not None and s2 is not None:
        winner_name = p1_name if s1 >= s2 else p2_name
    elif s1 is not None:
        winner_name = p1_name
    elif s2 is not None:
        winner_name = p2_name
    else:
        winner_name = p1_name
    r2_results.append((p1_name, p2_name, s1, s2, winner_name, rk1, rk2, ln1, ln2))
    print(f'  {p1_name:18s} {s1 or "-":>5}  vs  {s2 or "-":<5} {p2_name:18s} → {winner_name}')

# Round 3 (semifinals) — both use the same fastbreak day
r2_winners = [r[4] for r in r2_results]
SEMI1 = (r2_winners[0], r2_winners[1])
SEMI2 = (r2_winners[2], r2_winners[3])

print(f'\nFetching Semifinal scores from {fb_round3[1][:10]}...')

# Semifinal 1
d1 = fetch_score(SEMI1[0], fb_round3[0])
d2 = fetch_score(SEMI1[1], fb_round3[0])
s1 = d1.get('points')
s2 = d2.get('points')
semi1_rk1 = d1.get('rank')
semi1_rk2 = d2.get('rank')
semi1_ln1 = d1.get('players')
semi1_ln2 = d2.get('players')
if s1 is not None and s2 is not None:
    semi1_winner = SEMI1[0] if s1 >= s2 else SEMI1[1]
elif s1 is not None:
    semi1_winner = SEMI1[0]
elif s2 is not None:
    semi1_winner = SEMI1[1]
else:
    semi1_winner = SEMI1[0]
print(f'  {SEMI1[0]:18s} {s1 or "-":>5}  vs  {s2 or "-":<5} {SEMI1[1]:18s} → {semi1_winner}')
semi1_scores = (s1, s2)
semi1_loser = SEMI1[0] if semi1_winner != SEMI1[0] else SEMI1[1]

# Semifinal 2
d1 = fetch_score(SEMI2[0], fb_round3[0])
d2 = fetch_score(SEMI2[1], fb_round3[0])
s1 = d1.get('points')
s2 = d2.get('points')
semi2_rk1 = d1.get('rank')
semi2_rk2 = d2.get('rank')
semi2_ln1 = d1.get('players')
semi2_ln2 = d2.get('players')
if s1 is not None and s2 is not None:
    semi2_winner = SEMI2[0] if s1 >= s2 else SEMI2[1]
elif s1 is not None:
    semi2_winner = SEMI2[0]
elif s2 is not None:
    semi2_winner = SEMI2[1]
else:
    semi2_winner = SEMI2[0]
print(f'  {SEMI2[0]:18s} {s1 or "-":>5}  vs  {s2 or "-":<5} {SEMI2[1]:18s} → {semi2_winner}')
semi2_scores = (s1, s2)
semi2_loser = SEMI2[0] if semi2_winner != SEMI2[0] else SEMI2[1]


# ── Determine elimination rounds ────────────────────────────────────
all_usernames = {p[1] for p in PLAYERS}
r1_losers = {(r[0] if r[4] != r[0] else r[1]) for r in r1_results}
r2_losers = {(r[0] if r[4] != r[0] else r[1]) for r in r2_results}

elim = {}
for u in r1_losers:
    elim[u] = 1
for u in r2_losers:
    elim[u] = 2
elim[semi1_loser] = 3
elim[semi2_loser] = 3


# ── Insert participants ──────────────────────────────────────────────
for i, (wallet, username) in enumerate(PLAYERS):
    seed = i + 1
    pid = i + 1
    ins_participant(pid, t2, wallet, username, seed, elim.get(username))

print(f'\n  → {len(PLAYERS)} participants inserted')


# ── Insert matchups ──────────────────────────────────────────────────
mid = 1

# Round 1
for idx, (p1, p2, s1, s2, win, rk1, rk2, ln1, ln2) in enumerate(r1_results):
    ins_matchup(mid, t2, 1, idx, w[p1], w[p2], s1, s2, w[win], fb_round1[0], 'COMPLETE',
                r1=rk1, r2=rk2, l1=ln1, l2=ln2)
    mid += 1

# Round 2
for idx, (p1, p2, s1, s2, win, rk1, rk2, ln1, ln2) in enumerate(r2_results):
    ins_matchup(mid, t2, 2, idx, w[p1], w[p2], s1, s2, w[win], fb_round2[0], 'COMPLETE',
                r1=rk1, r2=rk2, l1=ln1, l2=ln2)
    mid += 1

# Round 3 — Semifinal 1 (COMPLETE)
ins_matchup(mid, t2, 3, 0,
            w[SEMI1[0]], w[SEMI1[1]],
            semi1_scores[0], semi1_scores[1],
            w[semi1_winner], fb_round3[0], 'COMPLETE',
            r1=semi1_rk1, r2=semi1_rk2, l1=semi1_ln1, l2=semi1_ln2)
mid += 1

# Round 3 — Semifinal 2 (COMPLETE)
ins_matchup(mid, t2, 3, 1,
            w[SEMI2[0]], w[SEMI2[1]],
            semi2_scores[0], semi2_scores[1],
            w[semi2_winner], fb_round3[0], 'COMPLETE',
            r1=semi2_rk1, r2=semi2_rk2, l1=semi2_ln1, l2=semi2_ln2)
mid += 1

# Round 4 — Finals (PENDING, both finalists known)
ins_matchup(mid, t2, 4, 0,
            w[semi1_winner], w[semi2_winner],
            None, None, None, None, 'PENDING')
mid += 1

conn.commit()
conn.close()
print(f'  → {mid - 1} matchups inserted (4 rounds)')
print('\nDone! Bracket seeded with real Fastbreak scores.')
