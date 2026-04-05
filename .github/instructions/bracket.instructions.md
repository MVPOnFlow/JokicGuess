---
applyTo: react-wallet/src/pages/FastbreakBracket.jsx,react-wallet/src/pages/FastbreakBracket.css
---

# Fastbreak Bracket Page — Product Spec

## Route
`/bracket` (supports `?id=<tournament_id>` for deep-linking to a specific tournament)

## Purpose
Single-elimination bracket tournaments powered by NBA TopShot Fastbreak daily scores. Users join via one of three buy-in types (token fee, freeroll, or moment deposit), a bracket is formed at signup close, and each round is resolved using the day's real Fastbreak rankings. Last player standing wins.

## API Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `/api/bracket/tournaments` | GET | Lists all bracket tournaments (newest first). Returns `buyin_type`, `moment_filters`, `num_moments`. |
| `/api/bracket/tournament/<id>` | GET | Returns full tournament detail: participants (incl. `moment_tx_id`, `moment_ids`), matchups by round, `total_rounds`, `round_schedule`. |
| `/api/bracket/tournament/<id>/signup` | POST | Register a wallet. Body varies by buy-in type (see below). |
| `/api/bracket/tournament/<id>/enrich-moments` | POST | Enrich raw Cadence moments with TopShot metadata. Uses DB cache (`moment_metadata` table). Body: `{ moments: [{id, playID, setName, serial}, ...] }`. |
| `/api/bracket/tournament/<id>/generate` | POST | Admin: close signups, seed participants randomly, create round-1 matchups with BYEs. |
| `/api/bracket/tournament/<id>/advance` | POST | Admin: score current-round matchups from `fastbreak_rankings`, generate next round. |
| `/api/bracket/tournament/<id>/payout` | POST | Admin: complete prize payout for finished tournament. TOKEN → sends 95% fees to winner Flow wallet; MOMENT → sends all deposited moments to winner's child Dapper wallet. |
| `/api/bracket/check-wallet` | GET | Pre-check wallet → TopShot username resolution. Returns `{ ts_username }` or error with `reason`. |

## Buy-in Types

### TOKEN (default)
- User pays an entry fee via FCL token transfer (e.g. 5 $MVP) to the community wallet.
- Signup body: `{ "wallet": "0x..." }` (token transfer happens client-side before calling signup).
- Prize pool = 95% of total fees collected.

### FREEROLL
- Free entry — no payment required.
- Signup body: `{ "wallet": "0x..." }`.
- fee_amount forced to 0, fee_currency blank.

### MOMENT
- User must deposit qualifying TopShot moment(s) from their Dapper collection to the treasury Dapper wallet.
- Tournament requires `moment_filters` (tier, player_name, set_name, series — at least one) and `num_moments` (1–50).
- Signup body: `{ "wallet": "0x...", "txId": "<flow_tx_id>", "momentIds": [12345, ...] }`.
- Backend verifies on-chain: tx sealed, proposer matches wallet, TopShot.Deposit events deposited to treasury, correct count.
- Replay protection: each `txId` can only be used for one signup.
- Prize: winner-takes-all (all deposited moments). Currently manual return by admin.

## Moment Picker (client-side)
- Opens when user clicks "Select Moment(s) & Sign Up" on a MOMENT tournament.
- Flow:
  1. Discover child Dapper account via `HybridCustody` Cadence script.
  2. Count moments via `CADENCE_MOMENT_COUNT`, paginated fetch via `CADENCE_LIST_MOMENTS_PAGE` (500/page).
  3. Filter out locked moments (only unlocked can be deposited).
  4. Enrich via `/api/bracket/tournament/<id>/enrich-moments` in 500-moment chunks. Server uses DB cache + batch GraphQL (48/request, 10 parallel workers).
  5. Apply tournament `moment_filters` client-side to determine eligible moments.
  6. Display in scrollable grid (24/page) with tier/player/set/season/team filters.
  7. User selects exactly `num_moments` cards, then clicks "Transfer & Sign Up".
  8. FCL transfer tx → wait for seal → POST `/signup` with `txId` + `momentIds`.
- Reuses `swap-moment-card` / `swap-moment-grid` CSS classes from Swap page for consistency.

## Key UI Elements
- **Tournament list view** — cards with status badges (Signup Open / In Progress / Complete), buy-in type, moment filter summary, num_moments, participant count.
- **Collapsible rules section** explaining the bracket flow.
- **Tournament detail view:**
  - Header with name, status, entry type, player count, round count.
  - Moment filter requirements banner (for MOMENT type).
  - Prize pool display (calculated for TOKEN; moment count for MOMENT; bragging rights for FREEROLL).
  - Winner banner (for completed tournaments).
  - Signup action card with buy-in-type-specific flow.
  - Bracket visualization: columns per round, matchup cards showing players and scores, expandable lineup details.
  - Participants table with seed, username, wallet, status, and deposited moment count (MOMENT type).

## State & Data Flow
- Subscribes to `fcl.currentUser()` for wallet connection.
- Auto-discovers child Dapper account on wallet connect via `HybridCustody` Cadence script.
- Fetches tournament list from `/api/bracket/tournaments` on mount.
- Deep-links via `?id=<tournament_id>` query parameter.
- Auto-refreshes active tournaments every 60s.
- Signup flow varies by `buyin_type`:
  - **TOKEN:** FCL token transfer → wait seal → POST `/signup`.
  - **FREEROLL:** POST `/signup` directly.
  - **MOMENT:** Open picker → select moments → FCL moment transfer → wait seal → POST `/signup` with txId + momentIds.
- Backend resolves wallet → TopShot username via `get_ts_username_from_flow_wallet`.
- Bracket rounds resolved by admin via `/advance` endpoint.

## Styling
- Uses `FastbreakBracket.css` for page-specific styling.
- Moment picker uses `mp-*` prefixed classes (mp-overlay, mp-modal, mp-header, mp-body, mp-actions, mp-pagination).
- Moment cards reuse `swap-moment-card` / `swap-moment-grid` from `Swap.css`.
- Follows the same dark theme / gold accent pattern as other pages.

## Database Tables
- `bracket_tournaments` — tournament metadata (name, fee, status, buyin_type, moment_filters, num_moments, current_round, max_rounds, winner, payout_tx_id).
- `bracket_participants` — signed-up players (wallet, ts_username, seed, eliminated_in_round, moment_tx_id, moment_ids).
- `bracket_matchups` — per-round pairings with scores, ranks, lineups, and winner.
- `bracket_rounds` — maps round_number → fastbreak_id + game_date + objectives for each tournament.
- `moment_metadata` — enrichment cache (moment_id → playerName, tier, setName, imageUrl, etc.). Shared across all tournaments.

## Tournament Lifecycle
1. **SIGNUP** — created with a `signup_close_ts` derived from first Fastbreak game start; users join via buy-in flow.
2. **ACTIVE** — after `/generate`, bracket is seeded and round-1 matchups are created. Each `/advance` call scores the current round and creates the next.
3. **COMPLETE** — final matchup resolved; `winner_wallet` is set.

## Bracket Generation Rules
- Participants shuffled randomly and assigned seed numbers.
- Bracket size is rounded up to the nearest power of 2.
- Excess slots become BYEs (auto-advance for some round-1 participants).

## Matchup Resolution & Tiebreakers
1. **Higher Fastbreak score wins** the matchup.
2. **Tiebreaker #1 — Cumulative tournament points**: if the current round's scores are tied, the player with more total points across all completed rounds wins.
3. **Tiebreaker #2 — Higher seed**: if cumulative points are also tied, the higher-seeded player (player 1 in the matchup) advances.
4. If only one player has a score, that player wins. If neither has a score, the higher-seeded player advances.
5. **BYE score tracking**: players who receive a BYE have their Fastbreak score back-filled so it counts toward cumulative tiebreaker totals.

## Moment Return Policy
- **Winner-takes-all** for MOMENT tournaments: all deposited moments go to the champion.
- Eliminated players' moments remain in the treasury Dapper wallet.
- Admin triggers payout via `/api/bracket/tournament/<id>/payout` endpoint, which discovers the winner's child Dapper wallet via `HybridCustody` and transfers all collected moments using the same server-signed `_send_moments_from_treasury` flow used by the Swap page.
- For TOKEN tournaments, payout sends 95% of collected entry fees to the winner's Flow wallet via `_send_mvp_from_treasury`.
- Payout TX is stored in `payout_tx_id` on `bracket_tournaments` for replay protection and audit.

## External Data Sources
- Flow blockchain (FCL token/moment transfers, Cadence scripts for collection queries).
- TopShot GraphQL API (moment enrichment, alias batching).
- `fastbreak_rankings` table (populated by existing Fastbreak scraping logic).

## Related Files
- `react-wallet/src/pages/FastbreakBracket.jsx`
- `react-wallet/src/pages/FastbreakBracket.css`
- `react-wallet/src/pages/Swap.css` (reused card/grid styles)
- `routes/api.py` — bracket tournament endpoints
- `db/init.py` — bracket table schema + `moment_metadata` cache table
- `tests/test_bracket.py` — bracket endpoint tests
