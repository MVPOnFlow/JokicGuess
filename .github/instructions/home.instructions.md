---
applyTo: react-wallet/src/pages/Home.jsx
---

# Home Page — Product Spec

## Route
`/` (index / landing page)

## Purpose
Landing page introducing MVP on Flow / Pet Jokic's Horses. Shows tokenomics (exchange rates for Common/Rare/TSD/Legendary), earn-and-spend overview, treasury snapshot, and an embedded DexScreener chart for $MVP on Flow EVM.

## API Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `/api/treasury` | GET | Returns treasury stats: tokens in the wild, holdings, backed supply, surplus. |

## Key UI Elements
- Hero banner with project branding.
- Tokenomics exchange-rate cards (grid) displaying $MVP values for each tier (Common, Rare, TSD, Legendary).
- Earn/spend lists explaining how users accumulate and use $MVP.
- Treasury summary cards (tokens in wild, holdings, backed supply, surplus) — fetched dynamically.
- DexScreener `<iframe>` chart embedding the $MVP/FLOW pair on Flow EVM DEX.
- Discord join link + "Start Swapping" CTA buttons.

## State & Data Flow
- Fetches treasury data from `/api/treasury` on component mount.
- Renders static tokenomics info alongside dynamic treasury stats.
- No wallet connection required for this page.

## Styling
- Uses `App.css` only (global styles).

## External Data Sources
- DexScreener embed (Flow EVM DEX chart).

## Implementation Notes
- Tokenomics exchange rates are hardcoded in the component. If rates change, update both `Home.jsx` and the `/images/Tokenomics.svg` asset.
- Treasury data response shape: `{ tokensInWild, holdings, backedSupply, surplus }`.
- Images referenced: `/images/Tokenomics.svg`, `/images/25-8-15-9-25.png`.

## Related Files
- `react-wallet/src/pages/Home.jsx`
- `routes/api.py` — `/api/treasury` endpoint
- `static/images/Tokenomics.svg`, `react-wallet/public/images/Tokenomics.svg`
