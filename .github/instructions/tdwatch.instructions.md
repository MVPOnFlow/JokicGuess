---
applyTo: react-wallet/src/pages/TDWatch.jsx,react-wallet/src/pages/TDWatch.css
---

# TD Watch Page — Product Spec

## Route
`/tdwatch`

## Purpose
Tracks Nikola Jokić's pursuit of the all-time triple-double record. Shows all-time leaders, the full Nuggets 2025–26 season schedule with game-by-game triple-double results, and a per-opponent TD breakdown.

## API Endpoints
None — all data is hardcoded in the component.

## Key UI Elements
- Hero section with triple-double count and record context.
- All-time triple-double leaders table (top 3: Westbrook, Jokić, Robertson).
- Full-season schedule table with columns: date, opponent, home/away indicator, TD badge (✅/❌), stat line (PTS/REB/AST).
- Per-opponent TD tracker table: TDs scored vs each team, remaining games, next game date.

## State & Data Flow
- All game data is a hardcoded array in the component with timestamps, opponent, stats, and TD boolean.
- `gamesByMonth` — games grouped by calendar month, computed client-side.
- `teamTDTracker` — per-opponent TD aggregation, computed client-side.
- No API calls, no wallet connection required.

## Styling
- Uses `TDWatch.css` for page-specific styling.

## External Data Sources
- None (data manually sourced and hardcoded).

## Implementation Notes
- **Data sourcing**: Game data and triple-double results should be synced from Nikola Jokić's Basketball Reference game log: https://www.basketball-reference.com/players/j/jokicni01/gamelog/2026
- **Triple-double leaders**: When updating all-time triple-double leaders (names or totals), always pull the latest numbers from Basketball Reference: https://www.basketball-reference.com/leaders/trp_dbl_career.html rather than relying on model memory.
- **Schedule syncing**: The Nuggets schedule and TD tracking also live in the DB (`nuggets_schedule` table) used by Discord bot commands. Keep both sources in sync.
- The schedule covers the 2025–26 NBA season. Update the hardcoded array as games are played.
- Season data imported from `jokicSeasonData.js` for shared use.

## Related Files
- `react-wallet/src/pages/TDWatch.jsx`
- `react-wallet/src/pages/TDWatch.css`
- `react-wallet/src/pages/jokicSeasonData.js` — shared season data
- `bot/tdwatch_commands.py` — Discord bot TD Watch commands
- `db/populate_nuggets_schedule.sql` — DB schedule seed
