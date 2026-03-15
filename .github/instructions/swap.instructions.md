---
applyTo: react-wallet/src/pages/Swap.jsx,react-wallet/src/pages/Swap.css
---

# Swap Page — Product Spec

## Route
`/swap`

## Purpose
Two-way Jokic moment exchange. In "Send" mode, users transfer TopShot moments from their linked Dapper wallet to the treasury and receive $MVP tokens. In "Get" mode, users spend $MVP to acquire moments from the treasury. Supports an optional horse NFT boost for a one-time 20% bonus.

## API Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `/api/moment-lookup` | POST | Enrich user's moments with TopShot metadata (tier, set, image, stats). |
| `/api/treasury/moments` | GET | List available treasury moments for "Get" mode. |
| `/api/swap/complete` | POST | Record a completed sell swap (moments sent to treasury). |
| `/api/swap/buy` | POST | Record a completed buy swap (moments acquired from treasury). |

## Key UI Elements
- **Mode toggle**: Send (sell moments for $MVP) / Get (buy moments with $MVP).
- **Dapper account discovery status**: Shows whether a child Dapper wallet was found via HybridCustody.
- **$MVP vault setup prompt**: If user lacks a vault, prompts to set one up via Cadence transaction.
- **Filter bar**: Tier, series, parallel, set dropdowns + text search.
- **Moment card grid**: Cards with selection checkboxes, moment image, tier badge, stats.
- **Horse NFT boost picker**: Optional one-time 20% $MVP bonus — user selects an unused horse NFT.
- **Swap summary sidebar**: Selected moments list, total $MVP calculation, boost indicator.
- **Multi-step progress modal**: Shows progress through transfer → seal → register steps.
- **Embedded `SwapLeaderboard`** component at the bottom.

## State & Data Flow
- Subscribes to `fcl.currentUser()` for wallet.
- Discovers child Dapper account via Cadence `HybridCustody` script.
- Loads user's moments in pages (500/page) via Cadence script, enriches via POST `/api/moment-lookup`.
- **Send swap flow**:
  1. User selects moments + optional horse NFT boost.
  2. Cadence transaction transfers moments (and optionally horse NFT) to treasury.
  3. POST to `/api/swap/complete` to register the swap and mint $MVP.
- **Get swap flow**:
  1. User selects moments from treasury.
  2. Cadence transaction sends $MVP to treasury vault.
  3. POST to `/api/swap/buy` to register and transfer moments to user.
- Horse NFT boost: Sends the `Swapboost30MVP` NFT alongside moments in a combined Cadence transaction for a one-time 20% $MVP bonus.

## Styling
- Uses `Swap.css` for page-specific and shared leaderboard styles.

## External Data Sources
- Flow blockchain (Cadence: HybridCustody, TopShot collection, $MVP vault, Swapboost30MVP NFTs).
- NBA TopShot (moment images from backend enrichment).

## Implementation Notes
- Moment loading uses paginated Cadence calls (500 IDs per page) to avoid script execution limits.
- The enrichment POST sends moment IDs to the backend, which scrapes TopShot for metadata.
- The multi-step modal tracks transaction hashes and sealing status.
- $MVP amounts are calculated based on tier exchange rates: Common=25, Rare=8, TSD=15, Legendary=9+25=34 (check `Home.jsx` for current rates).

## Related Files
- `react-wallet/src/pages/Swap.jsx`
- `react-wallet/src/pages/Swap.css`
- `react-wallet/src/pages/SwapLeaderboard.jsx` — embedded component
- `routes/api.py` — swap endpoints
- `utils/helpers.py` — username resolution for leaderboard
