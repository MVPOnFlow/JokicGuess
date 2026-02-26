# Copilot Instructions for JokicGuess

## Project Overview
- **JokicGuess** is a fan-powered web app and Discord bot celebrating Nikola Jokic and NBA TopShot moments on the Flow blockchain.
- The runtime is a single Python process: a Flask API + static React asset server and a Discord bot sharing the same DB connection.
- The project supports both local SQLite and Heroku PostgreSQL (see `db/init.py`, `db/connection.py`, `utils/helpers.py`).
- Frontend is a React Single Page App under `react-wallet/`, built with Vite and styled with Bootstrap.

## Key Components & Data Flow
- **Application entrypoint (`jokicguess.py`)**
  - Initializes Flask, DB connection (`get_db_connection`, `initialize_database`), and the Discord bot.
  - Registers HTTP routes via `routes/api.py::register_routes(app)`.
  - Registers Discord commands via `bot/commands.py::register_commands(bot, conn, cursor, db_type)`.
  - Starts Flask in a background thread and then runs the Discord bot (blocking).
- **API layer (`routes/api.py`)**
  - Serves JSON endpoints such as `/api/leaderboard`, `/api/treasury`, and FastBreak contest endpoints.
  - Uses `get_db()` from `db/connection.py` for per-request DB access and `utils.helpers` helpers for query preparation and mapping.
  - Serves the built React SPA from `react-build/`, falling back to `index.html` for unknown paths.
- **Discord bot (`bot/*.py`)**
  - Uses `discord.ext.commands` and `commands.Bot` with slash commands registered via `app_commands`.
  - Command modules: `commands.py`, `contest_commands.py`, `fastbreak_commands.py`, `petting_commands.py`, `swapfest_commands.py`, `tdwatch_commands.py`.
  - Commands interact with the same DB connection created in `jokicguess.py`.
- **Event / Flow logic (`swapfest.py`, `utils/helpers.py`)**
  - `swapfest.py` contains long-running background logic (started from `on_ready`) for Swapfest / Flow-related tasks.
  - Flow blockchain integration uses `flow_py_sdk` and custom helpers in `utils/helpers.py`.
- **Database (`db/`)**
  - `db/init.py` exposes `get_db_connection` and `initialize_database`, handling SQLite vs PostgreSQL based on `DATABASE_URL`.
  - `db/connection.py` exposes `get_db()` for Flask request-scoped DB access.
  - `populate_nuggets_schedule.sql` seeds the `nuggets_schedule` table used by TD Watch / bot commands.
- **Frontend (`react-wallet/`)**
  - React SPA with pages under `react-wallet/src/pages/`:
    - `Home.jsx` – tokenomics and treasury overview (fetches `/api/treasury`).
    - `Swapfest.jsx` – Swapfest leaderboard and event info (fetches `/api/leaderboard`).
    - `Fastbreak.jsx`, `HorseStats.jsx`, `TDWatch.jsx`, `Treasury.jsx`, `Vote.jsx` etc. for other features.
  - Uses Bootstrap 5 and custom CSS (`App.css`, `TDWatch.css`) for styling.
  - In production, built via Vite into `react-build/`, which Flask serves as static files.
- **Templates (`templates/`)**
  - Jinja2 HTML templates for legacy / server-rendered pages (e.g., `home.html`, `base.html`, `leaderboard.html`).
  - Static assets live under `static/images/` and the React build under `react-build/`.

## Developer Workflows
- **Run locally:**
  - Start Python app (Flask + Discord bot):
    - `python jokicguess.py`
  - React dev server (for SPA development):
    - `cd react-wallet`
    - `npm install`
    - `npm run dev`
- **Build frontend:**
  - `cd react-wallet`
  - `npm run build` → outputs production assets to `react-build/` (served by Flask).
- **Database:**
  - Local: `local.db` (SQLite) created/initialized via `db/init.py`.
  - Heroku/remote: set `DATABASE_URL` for PostgreSQL; code branches on DB type.
- **Discord bot:**
  - Runs as part of the same Python process as Flask.
  - Discord token is read from `DISCORD_TOKEN` env var or `secret.txt` fallback.

## Project-Specific Patterns
- **API endpoints** are versionless and return JSON (see `routes/api.py`).
- **Leaderboard/event logic** (Swapfest, FastBreak, etc.) is time-bounded and uses UTC timestamps.
- **Flow blockchain**: Interactions use `flow_py_sdk` and helpers in `utils/helpers.py` and `swapfest.py`.
- **React asset serving**: All unknown routes fallback to `react-build/index.html` for SPA routing.
- **Tokenomics and event images**: Use `/images/Tokenomics.svg` and `/images/25-8-15-9-25.png` for visual explanations.
- **TD Watch – schedule**: Jokic Nuggets schedule and triple-double tracking live in both the DB (`nuggets_schedule`) and front-end (`TDWatch.jsx`) as hardcoded schedules that should be synced from NBA.com or ESPN. Preferred sources for game logs and stats (in order): `https://www.nba.com/player/203999/nikola-jokic/`, `https://www.espn.com/nba/player/gamelog/_/id/3112335/nikola-jokic`, or the `nba_api` Python package (`from nba_api.stats.endpoints import PlayerGameLog`). Do NOT use Basketball Reference (they prohibit AI scraping).
- **TD Watch – triple-double leaders**: When updating all-time triple-double leaders (names or totals) in `TDWatch.jsx` or related UI, pull the latest numbers from NBA.com or ESPN rather than relying on model memory. Do NOT use Basketball Reference.
- **NBA stats verification**: For any Jokić stats (season averages, playoff game logs, records), fetch from NBA.com, ESPN, or use the `nba_api` Python package. Basketball Reference explicitly bans AI usage and must not be scraped or referenced as a live data source.

## Integration Points
- **Discord**: Bot logic and user mapping in database.
- **Flow blockchain**: API calls and event tracking in `swapfest.py`.
- **Frontend-backend**: React fetches from Flask API endpoints.

## Conventions
- Use UTC for all event timestamps and store timestamps as epoch seconds where applicable.
- Flask DB access via `get_db()` and context management in `db/connection.py`.
- Long-running jobs (e.g., Swapfest loops) are kicked off from the Discord bot `on_ready` event.
- React assets must be built into `react-build/` for production.
- Environment variables control DB, Discord bot, and Flow credentials (see `config.py`).

## Museum (3D Gallery – `Museum.jsx`)
- **Stack**: React Three Fiber (`@react-three/fiber`), drei (`@react-three/drei`), raw THREE.js, nipplejs (mobile joystick).
- **Scene constants** (top of file): `CW` (corridor width 14), `CH` (corridor height 5.5), `TV_SZ`, `TV_Y`, `TV_GAP`, `EYE_Y`, `SPEED`, `LIGHT_SPACING`, `CARPET_SPACING`, `CARPET_RADIUS`, `MOUNT_RANGE`, `MAX_VIDEOS`.
- **Component hierarchy**: `Museum` (data + entrance screen) → Canvas containing `Corridor`, `FloorCarpets`, `CameraLights`, `Movement`, `NearbyItems` → `WallTV` / `SeasonBanner`.
- **Performance rules** (important — do NOT break these):
  - Environment meshes (`Corridor`, `FloorCarpets`, decorative elements) **must** use `meshBasicMaterial` — no per-pixel lighting cost — except for the floor (`meshStandardMaterial` for specular response).
  - Emissive fixtures (ceiling lights, WallTV picture lights) use `meshBasicMaterial` — keep them cheap.
  - Share geometry instances (e.g. `_carpetGeo`, `_medallionGeo`) created once at module scope.
  - `NearbyItems` culls `WallTV`/`SeasonBanner` by camera distance (`MOUNT_RANGE = 50`). Only nearby items are mounted.
  - Video textures are capped at `MAX_VIDEOS = 4` simultaneous elements; loaded/disposed by distance.
  - Canvas uses `frameloop="demand"` with a `RenderLoop` component calling `invalidate()`.
- **Tone mapping**: ACES Filmic (`THREE.ACESFilmicToneMapping`) for cinematic color response. Ambient light is intentionally low (~0.35) with fog pushed back (30–100) for atmospheric depth.
- **Textures**: Floor (512²), wall (512²), and ceiling (256²) textures are procedurally generated via `<canvas>` + `CanvasTexture` inside `useMemo`. No image files needed for the base surfaces.
- **Showcase museum**: Navigate via `/museum?showcaseId=<uuid>`. Fetches from `/api/showcase/<binder_id>` instead of `/api/museum`. Skips wallet/ownership UI.

## NBA TopShot Data Scraping
- **Parallel fetching**: Use `concurrent.futures.ThreadPoolExecutor` (max 10 workers) to enrich moments in parallel.
- **Headers**: Always send a browser-like `User-Agent` header (see `_TS_HEADERS` in `routes/api.py`).

## Asset Pipeline
- **Dual locations**: Images used by both Flask (production) and Vite (dev) must exist in:
  - `static/images/` — served by Flask in production.
  - `react-wallet/public/images/` — served by Vite dev server; copied to `react-build/` on build.
- When adding a new image asset, copy it to **both** locations.
- React code references images as `/images/filename.ext` (root-relative).

## Testing
- **Framework**: pytest with fixtures in `tests/conftest.py`.
- **pyproject.toml quirk**: `addopts` includes coverage flags requiring `pytest-cov`. To run tests without coverage: `pytest -o "addopts=" tests/`.
- **Test files**: `tests/test_*.py` — one per module. Test fixtures use factory functions (e.g. `_make_binder_moment()`, `_make_rich_moment()`).
- **Mocking HTTP**: Use `unittest.mock.patch('requests.get')` for TopShot scraping tests; return mock responses with `__NEXT_DATA__` JSON embedded in HTML.

## References
- Backend: `jokicguess.py`, `routes/api.py`, `swapfest.py`, `db/init.py`, `db/connection.py`, `utils/helpers.py`, `bot/*.py`
- Frontend: `react-wallet/src/pages/`, `react-wallet/src/App.jsx`, `react-build/`
- Museum: `react-wallet/src/pages/Museum.jsx`, `react-wallet/src/pages/Museum.css`
- Tests: `tests/test_museum.py`, `tests/test_routes.py`, `tests/conftest.py`

---
_If any section is unclear or missing, please provide feedback to improve these instructions._
