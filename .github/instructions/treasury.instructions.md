---
applyTo: react-wallet/src/pages/Treasury.jsx
---

# Treasury Page — Product Spec

## Route
`/treasury`

## Purpose
Browsable catalog of every Nikola Jokić TopShot edition held in the community treasury vault. Users can filter by tier, set, parallel, and text search to explore the full collection.

## API Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `/api/treasury/editions` | GET | Returns all treasury editions with metadata (tier, set, parallel, image, stats, circulation, low ask). |

## Key UI Elements
- Summary stat cards: total editions, total moments, per-tier counts.
- Filter bar: text search input, tier dropdown, set dropdown, parallel dropdown.
- Responsive grid of `EditionCard` components, each showing:
  - Moment image (from TopShot).
  - Tier badge (color-coded).
  - Set name, description, date.
  - Game stats (points, rebounds, assists, etc.).
  - Circulation count and low ask price.

## State & Data Flow
- Fetches all editions from `/api/treasury/editions` on component mount.
- Client-side filtering via `useMemo` — no additional API calls when filters change.
- Loading and error states handled gracefully with spinners/messages.
- No wallet connection required.

## Styling
- Uses `App.css` (global styles) with `.treasury-card` class for edition cards.

## External Data Sources
- NBA TopShot (moment images via `imageUrl` field in API response).

## Implementation Notes
- The `/api/treasury/editions` endpoint scrapes TopShot data using parallel `ThreadPoolExecutor` (max 10 workers) with browser-like `User-Agent` headers.
- Each edition includes fields like `tier`, `setName`, `parallel`, `imageUrl`, `description`, `date`, `stats`, `circulationCount`, `lowAskPrice`.
- Filter dropdowns are dynamically populated from the fetched data (unique tiers, sets, parallels).

## Related Files
- `react-wallet/src/pages/Treasury.jsx`
- `routes/api.py` — `/api/treasury/editions` endpoint
