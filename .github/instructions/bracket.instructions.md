---
applyTo: react-wallet/src/pages/FastbreakBracket.jsx,react-wallet/src/pages/FastbreakBracket.css
---

# Fastbreak Bracket Page — Product Spec

## Route
`/bracket` (supports `?id=<tournament_id>` for deep-linking to a specific tournament)

## Purpose
Single-elimination bracket tournaments powered by NBA TopShot Fastbreak daily scores. Users pay an entry fee to join, a bracket is formed at signup close, and each round is resolved using the day's real Fastbreak rankings. Last player standing wins.

## API Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `/api/bracket/tournaments` | GET | Lists all bracket tournaments (newest first). |
| `/api/bracket/tournament/<id>` | GET | Returns full tournament detail: participants, matchups by round, total_rounds. |
| `/api/bracket/tournament/<id>/signup` | POST | Register a wallet for the tournament. Body: `{ "wallet": "0x..." }`. Resolves TopShot username. |
| `/api/bracket/tournament/<id>/generate` | POST | Admin: close signups, seed participants randomly, create round-1 matchups with BYEs. |
| `/api/bracket/tournament/<id>/advance` | POST | Admin: score current-round matchups from `fastbreak_rankings`, generate next round. Body: `{ "fastbreak_id": "..." }`. |

## Key UI Elements
- Tournament list view with status badges (Signup Open / In Progress / Complete).
- Collapsible rules section explaining the bracket flow.
- Tournament detail view:
  - Header with name, status, fee, player count, round count.
  - Winner banner (for completed tournaments).
  - Signup action card with FCL payment flow.
  - Bracket visualization: columns per round, matchup cards showing players and scores.
  - Participants table with seed, username, wallet, and status.

## State & Data Flow
- Subscribes to `fcl.currentUser()` for wallet connection.
- Fetches tournament list from `/api/bracket/tournaments` on mount.
- Deep-links via `?id=<tournament_id>` query parameter.
- Signup flow:
  1. User clicks "Sign Up" → FCL token transfer to community wallet.
  2. After on-chain seal, POST to `/api/bracket/tournament/<id>/signup`.
  3. Backend resolves wallet → TopShot username via `get_ts_username_from_flow_wallet`.
- Bracket rounds resolved by admin via `/advance` endpoint (takes a `fastbreak_id` to pull scores from `fastbreak_rankings`).

## Styling
- Uses `FastbreakBracket.css` for page-specific styling.
- Follows the same dark theme / gold accent pattern as other pages.

## Database Tables
- `bracket_tournaments` — tournament metadata (name, fee, status, current_round, winner).
- `bracket_participants` — signed-up players (wallet, ts_username, seed, elimination round).
- `bracket_matchups` — per-round pairings with scores and winner.

## Tournament Lifecycle
1. **SIGNUP** — created with a `signup_close_ts`; users pay fee and register.
2. **ACTIVE** — after `/generate`, bracket is seeded and round-1 matchups are created. Each `/advance` call scores the current round and creates the next.
3. **COMPLETE** — final matchup resolved; `winner_wallet` is set.

## Bracket Generation Rules
- Participants shuffled randomly and assigned seed numbers.
- Bracket size is rounded up to the nearest power of 2.
- Excess slots become BYEs (auto-advance for some round-1 participants).
- Winner determined by lower Fastbreak rank (better placement wins).
- If neither player has a score, the higher-seeded player advances.

## External Data Sources
- Flow blockchain (FCL token transfer for entry fee).
- `fastbreak_rankings` table (populated by existing Fastbreak scraping logic).

## Related Files
- `react-wallet/src/pages/FastbreakBracket.jsx`
- `react-wallet/src/pages/FastbreakBracket.css`
- `routes/api.py` — bracket tournament endpoints
- `db/init.py` — bracket table schema
- `tests/test_bracket.py` — bracket endpoint tests
