# Copilot Instructions for JokicGuess

## Project Overview
- **JokicGuess** is a fan-powered web app and Discord bot celebrating Nikola Jokic and NBA TopShot moments on the Flow blockchain.
- The backend is a Flask app (`jokicguess.py`) serving both API endpoints and static React assets (`react-build/`).
- Discord bot commands and event logic are integrated in the same Python backend.
- The project supports both local SQLite and Heroku PostgreSQL (see `db/connection.py`, `utils/helpers.py`).
- Frontend is a React app (see `react-wallet/`), built with Vite and styled with Bootstrap.

## Key Components & Data Flow
- **Backend (`jokicguess.py`, `swapfest.py`, `utils/helpers.py`)**
  - Flask routes serve API endpoints (e.g., `/api/leaderboard`) and static files.
  - Discord bot logic uses `discord.ext.commands` and interacts with the database.
  - Flow blockchain integration via `flow_py_sdk` (see `swapfest.py`, `utils/helpers.py`).
  - Database access is abstracted via `get_db()` (see `db/connection.py`).
- **Frontend (`react-wallet/`)**
  - React pages fetch data from Flask API (e.g., `/api/leaderboard`).
  - UI conventions: Bootstrap 5, custom hero sections, and tokenomics visualizations.
  - Example: `Swapfest.jsx` displays leaderboard and event info from backend API.
- **Templates (`templates/`)**
  - Jinja2 HTML templates for server-rendered pages (e.g., `home.html`, `base.html`).
  - Static assets in `static/images/` and `react-build/`.

## Developer Workflows
- **Run locally:**
  - Start Flask: `python jokicguess.py` (serves API and React build)
  - React dev: `cd react-wallet && npm install && npm run dev`
- **Build frontend:**
  - `cd react-wallet && npm run build` (outputs to `react-build/`)
- **Database:**
  - Local: `local.db` (SQLite)
  - Heroku: Set `DATABASE_URL` for PostgreSQL
- **Discord bot:**
  - Runs as part of Flask app; configure tokens in environment variables.

## Project-Specific Patterns
- **API endpoints** are versionless and return JSON (see Flask routes in `jokicguess.py`).
- **Leaderboard/event logic** is time-bounded and uses UTC timestamps (see `/api/leaderboard`).
- **Flow blockchain**: Interactions use `flow_py_sdk` and custom helper functions.
- **React asset serving**: All unknown routes fallback to `react-build/index.html` for SPA routing.
- **Tokenomics and event images**: Use `/images/Tokenomics.png` and `/images/25-8-15-9-25.png` for visual explanations.

## Integration Points
- **Discord**: Bot logic and user mapping in database.
- **Flow blockchain**: API calls and event tracking in `swapfest.py`.
- **Frontend-backend**: React fetches from Flask API endpoints.

## Conventions
- Use UTC for all event timestamps.
- Database access via `get_db()` and context management.
- React assets must be built into `react-build/` for production.
- Environment variables control DB and Discord bot configuration.

## References
- Backend: `jokicguess.py`, `swapfest.py`, `db/connection.py`, `utils/helpers.py`
- Frontend: `react-wallet/src/pages/`, `react-build/`
- Templates: `templates/`, `static/images/`

---
_If any section is unclear or missing, please provide feedback to improve these instructions._
