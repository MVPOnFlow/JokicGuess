---
applyTo: react-wallet/src/pages/Fastbreak.jsx
---

# Fastbreak Page — Product Spec

## Route
`/fastbreak`

## Purpose
Fastbreak Horse Race — a prediction/betting game where users pay a buy-in (in $MVP, FLOW, TSHOT, BETA, FROTH, or JUICE) to predict which TopShot user will rank highest in a daily Fastbreak game. Features a scrollable contest carousel, entry form, countdown timer, and prediction leaderboard.

## API Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `/api/fastbreak/contests` | GET | Returns all contests with status, buy-in info, and deadlines. |
| `/api/fastbreak/contest/{id}/prediction-leaderboard` | GET | Returns prediction leaderboard for a contest. Query: `?userWallet=...` |
| `/api/fastbreak/contest/{id}/entries` | POST | Submit a prediction entry (username pick + wallet). |
| `/api/fastbreak_racing_usernames` | GET | Returns autocomplete list of known TopShot usernames for predictions. |
| `/api/fastbreak_racing_stats/{username}` | GET | Returns per-user Fastbreak stats (best, mean, median, recent ranks). |
| `/api/has_lineup` | GET | Checks if a username has a lineup for a Fastbreak. Query: `?username=...&fastbreak_id=...` |

## Key UI Elements
- Collapsible rules section explaining the game.
- Horizontally-scrollable contest card carousel with arrow navigation.
- Status badges on each contest: countdown timer / started / completed.
- Buy-in form with:
  - Token selector (MVP, FLOW, TSHOT, BETA, FROTH, JUICE).
  - Autocomplete username input for predictions.
  - Submit button triggering blockchain transaction.
- Countdown timer to contest start.
- Prediction leaderboard table.
- User stats modal (opens on clicking a username).

## State & Data Flow
- Subscribes to `fcl.currentUser()` for wallet connection.
- Fetches contest list from `/api/fastbreak/contests` on mount.
- Auto-selects the best contest: recently started or next upcoming.
- Supports deep-linking via `?contest=ID` query parameter.
- Buy-in flow:
  1. User selects token and amount.
  2. Cadence `FungibleToken` transfer transaction is executed on-chain.
  3. POST to `/api/fastbreak/contest/{id}/entries` to register the entry.
- Leaderboard refreshes when contest or user changes.

## Styling
- Uses `App.css` only (global styles).

## External Data Sources
- Flow blockchain (Cadence token transfer transactions for buy-in).

## Implementation Notes
- Buy-in amounts vary by token type — the component maps token names to vault paths and receiver capabilities.
- The carousel uses horizontal scroll with overflow; arrow buttons scroll by card width.
- Countdown timer uses `setInterval` with 1-second updates.
- Autocomplete filters the username list client-side as the user types.
- The stats modal fetches per-user data from `/api/fastbreak_racing_stats/{username}`.

## Related Files
- `react-wallet/src/pages/Fastbreak.jsx`
- `routes/api.py` — contest/prediction endpoints
- `bot/fastbreak_commands.py` — Discord bot Fastbreak commands
- `react-wallet/src/pages/HorseStats.jsx` — shares username/stats endpoints
