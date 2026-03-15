---
applyTo: react-wallet/src/pages/HorseStats.jsx
---

# Horse Stats Page — Product Spec

## Route
`/horsestats`

## Purpose
Paginated leaderboard of Fastbreak Horse Race player stats over the last 15 daily classic games. Users can search for a username and view detailed stats in a modal.

## API Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `/api/fastbreak_racing_stats` | GET | Returns paginated leaderboard. Query: `?page=...&per_page=...` |
| `/api/fastbreak_racing_usernames` | GET | Returns all known usernames for autocomplete. |
| `/api/fastbreak_racing_stats/{username}` | GET | Returns detailed stats for a specific user. |

## Key UI Elements
- Search input with autocomplete dropdown (filters client-side from username list).
- Paginated leaderboard table with columns: rank, username, best score, mean score.
- Pagination controls (previous/next page buttons with page indicator).
- Stats modal showing: Flow wallet address, best, mean, median scores, and recent game ranks.

## State & Data Flow
- Fetches leaderboard page and username list on component mount.
- Clicking a username in the table or searching opens a modal with per-user stats.
- Client-side autocomplete filtering from the full username list.
- Pagination triggers a new API call with `page` parameter.
- No wallet connection required.

## Styling
- Uses `App.css` only (global styles).

## External Data Sources
- None (all data from backend).

## Implementation Notes
- The leaderboard shows aggregated stats over the last 15 daily classic Fastbreak games.
- The stats modal calls `/api/fastbreak_racing_stats/{username}` for detailed per-user data.
- The autocomplete dropdown is populated from `/api/fastbreak_racing_usernames` and filtered as the user types.
- Shares API endpoints with `Fastbreak.jsx`.

## Related Files
- `react-wallet/src/pages/HorseStats.jsx`
- `react-wallet/src/pages/Fastbreak.jsx` — shares username/stats endpoints
- `routes/api.py` — racing stats endpoints
