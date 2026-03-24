# Copilot Instructions for JokicGuess

## Project Overview
- **JokicGuess** is a fan-powered web app and Discord bot celebrating Nikola Jokic and NBA TopShot moments on the Flow blockchain.
- The runtime is a single Python process: a Flask API + static React asset server and a Discord bot sharing the same DB connection.
- The project supports both local SQLite and Heroku PostgreSQL (see `db/init.py`, `db/connection.py`, `utils/helpers.py`).
- Frontend is a React Single Page App under `react-wallet/`, built with Vite and styled with Bootstrap.

## Page Instruction Files Index
Each UI page has its own instruction file in `.github/instructions/` with a full product spec, API details, and implementation notes.

| Page | Route | Instruction File |
|---|---|---|
| Home | `/` | `.github/instructions/home.instructions.md` |
| Swapfest | `/swapfest` | `.github/instructions/swapfest.instructions.md` |
| Treasury | `/treasury` | `.github/instructions/treasury.instructions.md` |
| Vote | `/vote` | `.github/instructions/vote.instructions.md` |
| Fastbreak | `/fastbreak` | `.github/instructions/fastbreak.instructions.md` |
| Fastbreak Bracket | `/bracket` | `.github/instructions/bracket.instructions.md` |
| Horse Stats | `/horsestats` | `.github/instructions/horsestats.instructions.md` |
| TD Watch | `/tdwatch` | `.github/instructions/tdwatch.instructions.md` |
| Museum | `/museum` | `.github/instructions/museum.instructions.md` |
| Swap | `/swap` | `.github/instructions/swap.instructions.md` |
| NFT | `/nft` | `.github/instructions/nft.instructions.md` |
| Rewards | `/rewards` | `.github/instructions/rewards.instructions.md` |
| Swap Leaderboard | _(embedded component)_ | `.github/instructions/swap-leaderboard.instructions.md` |
| Blog | `/blog`, `/blog/*` | `.github/instructions/blog.instructions.md` |

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
  - React SPA with pages under `react-wallet/src/pages/`. See the **Page Instruction Files Index** above for per-page details.
  - Uses Bootstrap 5 and custom CSS (`App.css`, `TDWatch.css`, `Swap.css`, `NFT.css`, `Museum.css`, `Rewards.css`, `Blog.css`) for styling.
  - In production, built via Vite into `react-build/`, which Flask serves as static files.
- **Layout (`react-wallet/src/Layout.jsx`)**
  - Shared shell wrapping all pages. Renders the top navbar, wallet connect/disconnect button, `$MVP` balance, and footer.
  - Nav structure: three dropdown groups — **Fandom** (Museum, TD Watch, Blog, Vote), **Exchange** (Swap, Treasury, Horse NFT, Buy $MVP), **Play** (Fastbreak, Rewards).
  - Subscribes to `fcl.currentUser()` for wallet state; queries Flow blockchain every 30s for user's `$MVP` balance.
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

## Username Resolution Pipeline
- **Static map**: `DAPPER_WALLET_USERNAME_MAP` in `utils/helpers.py` — ~65 known Dapper wallet → TopShot username pairs.
- **Full pipeline** (`get_ts_username_from_flow_wallet`): Parent Flow wallet → `get_linked_child_account()` (Cadence HybridCustody) → Dapper child wallet → static map or `get_username_from_dapper_wallet_flow()` (TopShot GraphQL).
- **Caching**: Success-only in-memory cache with 24hr TTL (`_username_cache`). Failures are never cached.
- **gRPC throttling**: `_grpc_lock` with 0.35s delay between Cadence calls to avoid `RESOURCE_EXHAUSTED` errors from Flow access nodes.
- **ThreadPoolExecutor**: Capped at 3 workers for leaderboard endpoints to limit concurrent gRPC calls.
- **Connection management**: Both `get_linked_child_account` and `get_linked_parent_account` use `async with flow_client(...) as client:` to prevent channel leaks.

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

## API Endpoint Summary
| Endpoint | Method | Used by |
|---|---|---|
| `/api/treasury` | GET | Home |
| `/api/leaderboard` | GET | Swapfest |
| `/api/treasury/editions` | GET | Treasury |
| `/api/fastbreak/contests` | GET | Fastbreak |
| `/api/fastbreak/contest/{id}/prediction-leaderboard` | GET | Fastbreak |
| `/api/fastbreak/contest/{id}/entries` | POST | Fastbreak |
| `/api/fastbreak_racing_usernames` | GET | Fastbreak, HorseStats |
| `/api/fastbreak_racing_stats` | GET | HorseStats |
| `/api/fastbreak_racing_stats/{username}` | GET | Fastbreak, HorseStats |
| `/api/has_lineup` | GET | Fastbreak |
| `/api/museum` | GET | Museum |
| `/api/showcase/{binder_id}` | GET | Museum |
| `/api/moment-lookup` | POST | Swap |
| `/api/treasury/moments` | GET | Swap |
| `/api/swap/complete` | POST | Swap |
| `/api/swap/buy` | POST | Swap |
| `/api/nft/holders` | GET | NFT |
| `/api/rewards` | GET | Rewards |
| `/api/swap/leaderboard` | GET | SwapLeaderboard |
| `/api/blog/comments/{articleId}` | GET | Blog articles |
| `/api/blog/comments` | POST | Blog articles |

## References
- Backend: `jokicguess.py`, `routes/api.py`, `swapfest.py`, `db/init.py`, `db/connection.py`, `utils/helpers.py`, `bot/*.py`
- Frontend: `react-wallet/src/pages/`, `react-wallet/src/App.jsx`, `react-wallet/src/Layout.jsx`, `react-build/`
- Per-page specs: `.github/instructions/*.instructions.md`
- Tests: `tests/test_museum.py`, `tests/test_routes.py`, `tests/conftest.py`

---
_If any section is unclear or missing, please provide feedback to improve these instructions._
