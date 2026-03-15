---
applyTo: react-wallet/src/pages/NFT.jsx,react-wallet/src/pages/NFT.css
---

# NFT Page — Product Spec

## Route
`/nft`

## Purpose
"Jokic's Horse Stable" — view and manage Swapboost30MVP horse NFTs. Users can enable their collection, view their owned horses, or browse all 50 horses across all holders. Each horse gives a one-time 20% swap boost on the Swap page.

## API Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `/api/nft/holders` | GET | Returns all 50 NFTs with owner info (wallet, username). |

## Key UI Elements
- Hero section with horse stable branding.
- Wallet connect prompt (if not connected).
- "My Horses" / "All Horses" tab toggle.
- Collection enable button (if user hasn't set up their collection).
- NFT card grid:
  - IPFS thumbnail image.
  - Horse name and serial number.
  - Special ribbon for serial #1, #15, #50.
  - Owner info visible in "All Horses" view.
- Flowty collection external link.

## State & Data Flow
- Subscribes to `fcl.currentUser()` for wallet connection.
- **Collection check**: Cadence script checks if user has a `NonFungibleToken.Collection` capability for `Swapboost30MVP`.
- **My Horses**: Lists user's NFTs via Cadence script (iterates 1..totalSupply, resolves `MetadataViews.Display`).
- **All Horses**: Fetches from `/api/nft/holders` backend endpoint.
- **Collection setup**: Executes a Cadence transaction to initialize the user's collection.
- No wallet required for "All Horses" view.

## Styling
- Uses `NFT.css` for page-specific styling.

## External Data Sources
- Flow blockchain (Cadence: `Swapboost30MVP`, `NonFungibleToken`, `MetadataViews`).
- IPFS (NFT thumbnail images hosted on IPFS).

## Implementation Notes
- Total supply is 50 horse NFTs.
- Serial numbers #1, #15, and #50 get special visual treatment (ribbons).
- The `/api/nft/holders` endpoint uses `DAPPER_WALLET_USERNAME_MAP` from `utils/helpers.py` to resolve owner usernames.
- Horses are one-time use for the 20% swap boost — once used, the horse NFT is transferred to the treasury.

## Related Files
- `react-wallet/src/pages/NFT.jsx`
- `react-wallet/src/pages/NFT.css`
- `routes/api.py` — `/api/nft/holders` endpoint
- `utils/helpers.py` — `DAPPER_WALLET_USERNAME_MAP` for owner username resolution
- `react-wallet/src/pages/Swap.jsx` — horse NFT boost integration
