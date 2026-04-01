---
applyTo: react-wallet/src/pages/SwapLeaderboard.jsx
---

# Swap Leaderboard — Product Spec

## Route
No standalone route — this is a shared component embedded in the **Swap** and **Rewards** pages.

## Purpose
Monthly swap leaderboard showing who earned the most $MVP and raffle points through swapping. Supports month-by-month navigation.

## API Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `/api/swap/leaderboard` | GET | Returns leaderboard for a given month. Query: `?month=YYYY-MM` |

## Key UI Elements
- Month selector dropdown (populated from API response's available months).
- Leaderboard table with columns:
  - Rank (with medal emojis 🥇🥈🥉 for top 3).
  - Username (linked to TopShot profile or Flowdiver wallet page).
  - Swap count.
  - $MVP earned.
  - Raffle points.

## State & Data Flow
- Fetches leaderboard for the selected month; defaults to the current month on mount.
- Available months list comes from the API response.
- Username resolution happens server-side via `get_ts_username_from_flow_wallet` pipeline.

## Styling
- Styled via `Swap.css` classes (`.swap-leaderboard-card`, `.swap-lb-*`).

## External Data Sources
- None (all data from backend).

## Implementation Notes
- The `/api/swap/leaderboard` endpoint uses `ThreadPoolExecutor` (max 3 workers) and `get_ts_username_from_flow_wallet` for username resolution.
- Username resolution pipeline: parent Flow wallet → child Dapper wallet (via HybridCustody Cadence) → `DAPPER_WALLET_USERNAME_MAP` or TopShot GraphQL.
- Success-only in-memory cache (24hr TTL) avoids repeated gRPC calls. Failures are never cached.
- gRPC calls are throttled with a 0.35s delay lock to prevent `RESOURCE_EXHAUSTED` errors.
- Users with resolved usernames link to `https://nbatopshot.com/user/{username}`; unresolved wallets link to `https://www.flowdiver.io/account/{address}`.
- The backend always includes the current month in `availableMonths` even if no swaps exist yet, so the dropdown is never empty.

## Monthly Prize Configuration
- Prizes are defined per month in `prizesByMonth` inside `SwapLeaderboard.jsx`.
- Each key is a `YYYY-MM` string mapping to an array of prize objects `{ label, url, internal? }`.
- When the selected month has an entry in `prizesByMonth`, the full prize draft section is shown.
- When the selected month has no entry (prizes are `null`), a "Prizes for {month} — TBD" message is shown instead.
- **To add prizes for a new month:** add a new entry to `prizesByMonth`, e.g. `'2026-04': [{ label: '...', url: '...' }, ...]`.

## Related Files
- `react-wallet/src/pages/SwapLeaderboard.jsx`
- `react-wallet/src/pages/Swap.css` — leaderboard styles
- `react-wallet/src/pages/Swap.jsx` — parent page (embeds this component)
- `react-wallet/src/pages/Rewards.jsx` — parent page (embeds this component)
- `routes/api.py` — `/api/swap/leaderboard` endpoint
- `utils/helpers.py` — `get_ts_username_from_flow_wallet`, `DAPPER_WALLET_USERNAME_MAP`, `_username_cache`
