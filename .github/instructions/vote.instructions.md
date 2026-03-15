---
applyTo: react-wallet/src/pages/Vote.jsx
---

# Vote Page — Product Spec

## Route
`/vote`

## Purpose
A humorous MVP vote page. Users can only successfully vote for Jokic — other candidates' buttons dodge the mouse cursor. After voting, results show 100% for Jokic.

## API Endpoints
None — this is a purely client-side page.

## Key UI Elements
- Hero section with trophy emoji.
- Vote button grid: Jokic button (golden, stays put), other candidate buttons (muted, dodge the cursor).
- Animated result bars after voting, showing 100% for Jokic.
- All styling is inline (no external CSS classes).

## State & Data Flow
- Pure client-side state with a single `hasVoted` boolean.
- Other candidates' buttons use `useRef` to animate away on hover via random CSS `translate()`.
- No API calls, no wallet connection required.

## Styling
- Inline styles only (no external CSS file).

## External Data Sources
None.

## Implementation Notes
- The button dodge animation is intentionally playful — hovering over a non-Jokic button randomizes its position.
- The "results" are always hardcoded: Jokic = 100%.
- This page is purely for fun and community engagement.

## Related Files
- `react-wallet/src/pages/Vote.jsx`
