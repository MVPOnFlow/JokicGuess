---
applyTo: react-wallet/src/pages/Swapfest.jsx
---

# Swapfest Page — Product Spec

## Route
`/swapfest`

## Purpose
Displays the Swap Fest leaderboard — a community contest where users earn points by swapping Jokic TopShot moments. Shows the prize pool and ranked participants.

## API Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `/api/leaderboard` | GET | Returns leaderboard entries (ranked users with points, timestamps) and prize pool info. |

## Key UI Elements
- Image banner for the Swap Fest event.
- Prize pool text display.
- Responsive table with columns: rank, TopShot username, points, last scored timestamp, prize.

## State & Data Flow
- Fetches leaderboard + prize pool data from `/api/leaderboard` on component mount.
- Timestamps are parsed as UTC and formatted to the user's local timezone for display.
- No wallet connection required.

## Styling
- Uses `App.css` only (global styles).

## External Data Sources
- None (all data comes from the backend).

## Implementation Notes
- The `/api/leaderboard` endpoint uses `ThreadPoolExecutor` (max 3 workers) + `get_ts_username_from_flow_wallet` to resolve Flow addresses to TopShot usernames.
- Username resolution may return `None` for unresolvable wallets — the UI should handle missing usernames gracefully.
- Leaderboard/event logic is time-bounded and uses UTC timestamps.

## Related Files
- `react-wallet/src/pages/Swapfest.jsx`
- `routes/api.py` — `/api/leaderboard` endpoint
- `utils/helpers.py` — `get_ts_username_from_flow_wallet`, `DAPPER_WALLET_USERNAME_MAP`
- `swapfest.py` — background Swapfest event logic
