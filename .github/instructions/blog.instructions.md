---
applyTo: react-wallet/src/pages/blog/**
---

# Blog — Product Spec

## Routes
| Route | Component | Description |
|---|---|---|
| `/blog` | `BlogList.jsx` | Blog index — lists all articles with a featured article and card grid. |
| `/blog/okc-game-feb-01-2026` | `OKCGameFeb012026.jsx` | Game analysis: Thunder vs Nuggets, Feb 1, 2026. |
| `/blog/triple-double-chase` | `TripleDoubleChase.jsx` | Career milestone: Jokić's triple-double leaderboard climb. |
| `/blog/flow-security-incident` | `FlowSecurityIncident.jsx` | Article about the Dec 27, 2025 Flow blockchain security breach. |
| `/blog/jokic-passes-oscar` | `JokicPassesOscar.jsx` | Milestone: Jokić passes Oscar Robertson for 2nd all-time in triple-doubles. |

## Purpose
Blog section with articles about Jokić game analysis, career milestones, and project/blockchain updates. Features a blog index (BlogList) and individual article pages with a shared comments system.

## API Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `/api/blog/comments/{articleId}` | GET | Returns comments for a specific article. |
| `/api/blog/comments` | POST | Submit a new comment (name optional, text required, articleId required). |

## Key UI Elements

### BlogList (index page)
- Hero section with blog branding.
- Featured article card (large, two-column layout).
- Article grid (cards with category badges, dates, excerpts).
- Newsletter signup section.
- Article metadata imported from `articleData.js`.

### Individual Articles
- Article layout: header (title, date, category badge), body content.
- Game summary cards with boxscore and quarter-by-quarter tables (where applicable).
- Related articles sidebar.
- `Comments` component (shared across all articles):
  - Comment form: name (optional), text (required).
  - Comment thread with timestamps.
  - Success/error alerts.

## State & Data Flow
- **BlogList**: No API calls — article metadata is imported from `articleData.js` (static data).
- **Individual articles**: Comments are fetched from `/api/blog/comments/{articleId}` on mount.
- **Comment submission**: POST to `/api/blog/comments` with `{ articleId, name, text }`.
- No wallet connection required for any blog page.

## Styling
- All blog pages use `Blog.css`.

## External Data Sources
- None (article content is hardcoded; comment data from backend).

## Implementation Notes
- Article metadata lives in `articleData.js` — when adding a new article, add its metadata there and create a new article component.
- Each article component has a unique `articleId` string used for comments.
- The `Comments` component is shared across all article pages.
- Article content (text, tables, stats) is hardcoded in each article component — not fetched from API.
- Related articles are manually curated in each article component.

## Related Files
- `react-wallet/src/pages/blog/BlogList.jsx` — blog index
- `react-wallet/src/pages/blog/articleData.js` — article metadata
- `react-wallet/src/pages/blog/Comments.jsx` — shared comments component
- `react-wallet/src/pages/blog/Blog.css` — blog styling
- `react-wallet/src/pages/blog/OKCGameFeb012026.jsx`
- `react-wallet/src/pages/blog/TripleDoubleChase.jsx`
- `react-wallet/src/pages/blog/FlowSecurityIncident.jsx`
- `react-wallet/src/pages/blog/JokicPassesOscar.jsx`
- `routes/api.py` — `/api/blog/comments` endpoints
