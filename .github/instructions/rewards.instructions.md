---
applyTo: react-wallet/src/pages/Rewards.jsx,react-wallet/src/pages/Rewards.css
---

# Rewards Page — Product Spec

## Route
`/rewards`

## Purpose
Shows the raffle reward pool and explains how rewards work. Every Jokić triple-double triggers a weighted raffle where swap points equal raffle entries. Lists all prizes with quantities and includes a "Copy for Wheel of Names" button. Also embeds the `SwapLeaderboard` component.

## API Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `/api/rewards` | GET | Returns the reward pool: list of prizes with names, types, and quantities. |
| `/api/swap/leaderboard` | GET | _(via embedded SwapLeaderboard)_ Monthly swap leaderboard data. |

## Key UI Elements
- Hero section with CTA button to the Swap page.
- Stat cards: total prizes count, unique reward types.
- 4-step "How It Works" visual flow explaining the raffle mechanics.
- Reward pool table: emoji by type, prize name, quantity available.
- "Copy for Wheel of Names" clipboard button — flattens items by quantity for pasting into wheelofnames.com.
- Embedded `SwapLeaderboard` component showing current month's swap rankings.

## State & Data Flow
- Fetches reward pool from `/api/rewards` on component mount.
- "Copy for Wheel of Names" flattens the prize list (repeating each item by its quantity) and copies to clipboard.
- No wallet connection required.

## Styling
- Uses `Rewards.css` for page-specific styling.
- Imports `Swap.css` for shared leaderboard styles (used by embedded `SwapLeaderboard`).

## External Data Sources
- None (all data from backend).

## Implementation Notes
- The raffle is triggered by Jokić triple-doubles — each TD triggers one raffle draw.
- Swap points from the current month's leaderboard determine raffle entry weight.
- The "Wheel of Names" copy format is one item per line, with items repeated by quantity.
- The embedded `SwapLeaderboard` is the same component used on the Swap page.

## Related Files
- `react-wallet/src/pages/Rewards.jsx`
- `react-wallet/src/pages/Rewards.css`
- `react-wallet/src/pages/SwapLeaderboard.jsx` — embedded component
- `react-wallet/src/pages/Swap.css` — shared leaderboard styles
- `routes/api.py` — `/api/rewards` endpoint
