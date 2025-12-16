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
- **TD Watch – schedule**: Jokic Nuggets schedule and triple-double tracking live in both the DB (`nuggets_schedule`) and front-end (`TDWatch.jsx`) as hardcoded schedules that should be synced from Nikola Jokić's Basketball Reference game log: https://www.basketball-reference.com/players/j/jokicni01/gamelog/2026.
- **TD Watch – triple-double leaders**: When updating all-time triple-double leaders (names or totals) in `TDWatch.jsx` or related UI, always pull the latest numbers from Basketball Reference: https://www.basketball-reference.com/leaders/trp_dbl_career.html rather than relying on model memory.

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

## References
- Backend: `jokicguess.py`, `routes/api.py`, `swapfest.py`, `db/init.py`, `db/connection.py`, `utils/helpers.py`, `bot/*.py`
- Frontend: `react-wallet/src/pages/`, `react-wallet/src/App.jsx`, `react-build/`

---
_If any section is unclear or missing, please provide feedback to improve these instructions._
