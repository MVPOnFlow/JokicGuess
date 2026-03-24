---
applyTo: react-wallet/src/pages/FastbreakBracket.jsx,react-wallet/src/pages/FastbreakBracket.css
---

# Fastbreak Bracket Page — Product Spec

## Route
`/bracket` (supports `?id=<tournament_id>` for deep-linking to a specific tournament)

## Purpose
Single-elimination bracket tournaments powered by NBA TopShot **Classic Fastbreak** daily scores. Users pay an entry fee to join, a bracket is formed at signup close, and each round is resolved using the day's real Fastbreak scores fetched via TopShot's public API. Last player standing wins the prize pool (95 % of collected fees).

## API Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `/api/bracket/tournaments` | GET | Lists all bracket tournaments (newest first). Returns `max_rounds`, `max_players`, and `participant_count`. |
| `/api/bracket/tournaments` | POST | Admin: create a new tournament. Body: `{ "name", "start_date", "fee_amount", "fee_currency", "max_rounds" }`. Discovers Classic Fastbreak days from TopShot API and pre-assigns them to rounds. |
| `/api/bracket/tournament/<id>` | GET | Full tournament detail: participants, matchups by round, round schedule with objectives, `max_rounds`, `max_players`, `total_rounds`. |
| `/api/bracket/tournament/<id>/signup` | POST | Register a wallet. Body: `{ "wallet": "0x..." }`. Resolves TopShot username. Enforces max-players cap (`2^max_rounds`). |
| `/api/bracket/tournament/<id>/generate` | POST | Admin: close signups, seed participants randomly, create round-1 matchups with BYEs. |
| `/api/bracket/tournament/<id>/advance` | POST | Admin (manual fallback): score current-round matchups, generate next round. |
| `/api/bracket/check-wallet` | GET | Pre-check whether a Flow wallet can be resolved to a TopShot username. Query: `?wallet=0x...`. Returns `{ "ts_username" }` or error with `reason` (`no_child` / `no_username`). |

## Create Tournament Flow (Admin)
1. Admin fills in: **Name**, **Start Date** (YYYY-MM-DD), **Fee**, **Currency**, **Max Rounds** (1–6, default 3).
2. POST to `/api/bracket/tournaments` → backend calls `extract_fastbreak_runs()` to discover upcoming Classic Fastbreak days from `start_date`, takes the first `max_rounds` days, and inserts them into `bracket_rounds` with objectives.
3. `signup_close_ts` is derived from the first Fastbreak's `gamesStartAt`.
4. Max players = `2^max_rounds` (e.g. 3 rounds → 8 players max).

## Key UI Elements
- **Tournament list** with status badges (Signup Open / In Progress / Signup Closed / Complete), player count shown as "X / Y" (current / max capacity).
- Collapsible rules section explaining the bracket flow.
- **Admin panel** (visible only to `ADMIN_WALLET`): create tournament form with Name, Start Date, Fee, Currency, and Max Rounds dropdown.
- **Tournament detail view:**
  - Header with name, status, fee, player count (X / Y), round count, countdown timer.
  - Prize pool display: `fee × players × 95%`.
  - Winner banner (for completed tournaments).
  - Signup action card with FCL payment flow and Dapper wallet pre-check.
  - "Tournament full" banner when max capacity reached.
  - Bracket visualization: columns per round with round names (Round 1 / Quarterfinals / Semifinals / Finals), matchup cards showing players, scores, and lineups. Click to expand matchup details.
  - Round schedule showing game date and objectives for each round, with LIVE / PROJECTED / FINISHED status indicators.
  - Participants table with seed, username, wallet, and elimination status.

## State & Data Flow
- Subscribes to `fcl.currentUser()` for wallet connection.
- On wallet connect, runs a Cadence script (`HybridCustody.getChildAddresses`) to discover linked Dapper child account. Shows warning if no child found.
- Fetches tournament list from `/api/bracket/tournaments` on mount.
- Deep-links via `?id=<tournament_id>` query parameter.
- Auto-refreshes active tournament detail every 60 seconds.
- **Signup flow:**
  1. Client verifies Dapper child account exists (Cadence query).
  2. User clicks "Sign Up" → FCL token transfer to community wallet.
  3. After on-chain seal, POST to `/api/bracket/tournament/<id>/signup`.
  4. Backend resolves wallet → TopShot username via `get_ts_username_from_flow_wallet`.
  5. Backend rejects if tournament is full (`participant_count >= 2^max_rounds`).

## Bracket Poller (Background Daemon)
- `bot/bracket_poller.py` runs a background thread polling every 10 minutes.
- For each ACTIVE tournament, the poller:
  1. Fetches current Fastbreak statuses from TopShot API (`_fetch_fb_status_map`).
  2. Updates live scores on PENDING matchups using `get_rank_and_lineup_for_user()`.
  3. Creates PROJECTED next-round matchups (before current round finishes).
  4. When a Fastbreak status is `FAST_BREAK_FINISHED`, finalizes the round: sets winners, marks losers as eliminated, advances `current_round`.
  5. If the final round is complete, marks the tournament as `COMPLETE` with `winner_wallet`.
- Started via `start_bracket_poller()` in `jokicguess.py`.

## Styling
- Uses `FastbreakBracket.css` for page-specific styling.
- Follows the same dark theme / gold accent pattern as other pages.
- Matchup cards have status-based coloring: green border for FINISHED, pulsing gold for LIVE, grey for PROJECTED.

## Database Tables
- `bracket_tournaments` — tournament metadata: name, fee_amount, fee_currency, signup_close_ts, status (`SIGNUP`/`ACTIVE`/`COMPLETE`), current_round, **max_rounds** (1–6, default 6), winner_wallet, created_at.
- `bracket_participants` — signed-up players: wallet_address, ts_username, seed_number, eliminated_in_round. Unique on (tournament_id, wallet_address).
- `bracket_matchups` — per-round pairings: player wallets, scores, ranks, lineups (JSON), winner_wallet, fastbreak_id, status (`PENDING`/`LIVE`/`PROJECTED`/`FINISHED`).
- `bracket_rounds` — round schedule: tournament_id, round_number, fastbreak_id, game_date, objectives. Unique on (tournament_id, round_number). Pre-populated at tournament creation from TopShot API.

## Tournament Lifecycle
1. **SIGNUP** — created with `signup_close_ts` and `max_rounds`. Users pay fee and register (capped at `2^max_rounds` players).
2. **ACTIVE** — after `/generate`, bracket is seeded and round-1 matchups are created. The bracket poller automatically scores rounds, finalizes them when Fastbreaks finish, and advances to the next round.
3. **COMPLETE** — final matchup resolved; `winner_wallet` is set.

## Bracket Generation Rules
- Participants shuffled randomly and assigned seed numbers.
- Bracket size is rounded up to the nearest power of 2.
- Excess slots become BYEs (auto-advance for some round-1 participants).
- Winner determined by **higher Fastbreak score** (more points wins).
- If neither player has a score, the higher-seeded player advances.
- Scores and lineups are fetched live from TopShot via `get_rank_and_lineup_for_user(username, fastbreak_id)`.

## Round Naming
Rounds are named dynamically based on total rounds: the last round is always "Finals", second-to-last is "Semifinals", third-to-last is "Quarterfinals", and earlier rounds are "Round N".

## External Data Sources
- **Flow blockchain** — FCL token transfer for entry fee; Cadence `HybridCustody.getChildAddresses` for Dapper wallet discovery.
- **TopShot Public API** — `extract_fastbreak_runs()` for Classic Fastbreak discovery; `get_rank_and_lineup_for_user()` for live scores and lineups.

## Related Files
- `react-wallet/src/pages/FastbreakBracket.jsx` — main bracket UI component
- `react-wallet/src/pages/FastbreakBracket.css` — bracket-specific styles
- `routes/api.py` — bracket tournament endpoints (search for `bracket`)
- `bot/bracket_poller.py` — background poller daemon for live scoring
- `db/init.py` — bracket table schema and `max_rounds` migration
- `tests/test_bracket.py` — bracket endpoint tests
