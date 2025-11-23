# JokicGuess - Reorganized Code Structure

This document explains the new, reorganized file structure of the JokicGuess project.

## New File Structure

```
JokicGuess/
├── main.py                    # Main entry point (Flask + Discord bot)
├── config.py                  # Configuration constants and environment variables
├── swapfest.py               # Swapfest blockchain scraping logic (unchanged)
├── requirements.txt          # Python dependencies
├── Procfile                  # Updated to use main.py
├── Dockerfile                # Docker configuration
│
├── bot/
│   ├── __init__.py           # Bot module init
│   └── commands.py           # All Discord bot slash commands
│
├── routes/
│   ├── __init__.py           # Routes module init
│   └── api.py                # All Flask API endpoints
│
├── db/
│   ├── __init__.py           # Database module init (existing)
│   ├── connection.py         # Database connection (existing)
│   └── init.py               # Database schema initialization
│
├── utils/
│   ├── __init__.py           # Utils module init (existing)
│   └── helpers.py            # Helper functions (existing)
│
├── templates/                # Jinja2 templates (unchanged)
├── static/                   # Static assets (unchanged)
├── react-wallet/             # React frontend source (unchanged)
└── react-build/              # Built React app (unchanged)
```

## Module Breakdown

### `main.py`
- **Purpose**: Application entry point
- **Responsibilities**:
  - Initialize Flask app
  - Initialize Discord bot
  - Connect database
  - Register routes and commands
  - Start both Flask server and Discord bot

### `config.py`
- **Purpose**: Centralized configuration
- **Contains**:
  - Swapfest event timings
  - Discord channel IDs
  - Petting rewards configuration
  - Flow blockchain settings
  - Database URLs
  - Flask server settings

### `bot/commands.py`
- **Purpose**: Discord bot command handlers
- **Contains all slash commands**:
  - Contest commands (`/start`, `/predict`, `/winner`)
  - Petting commands (`/pet`, `/pet_all`, `/claim`)
  - FastBreak admin commands
  - Swapfest commands (`/gift_leaderboard`)
  - Admin utilities

### `routes/api.py`
- **Purpose**: Flask REST API endpoints
- **Contains all API routes**:
  - `/api/leaderboard` - Swapfest leaderboard
  - `/api/treasury` - Treasury stats
  - `/api/fastbreak/contests` - FastBreak contests
  - `/api/fastbreak_racing_stats` - Horse racing stats
  - React SPA serving

### `db/init.py`
- **Purpose**: Database schema management
- **Responsibilities**:
  - Create database connection
  - Initialize all tables
  - Create views and materialized views
  - Handle PostgreSQL vs SQLite differences

## Migration from `jokicguess.py`

The original `jokicguess.py` has been backed up to `jokicguess_backup.py` and its functionality has been split as follows:

| Original Location | New Location | Description |
|-------------------|--------------|-------------|
| Flask app setup | `main.py` | App initialization |
| Flask routes | `routes/api.py` | All API endpoints |
| Discord bot setup | `main.py` | Bot initialization |
| Discord commands | `bot/commands.py` | All slash commands |
| Database schema | `db/init.py` | Table creation |
| Constants | `config.py` | All configuration |

## Running the Application

### Local Development
```bash
python main.py
```

### Heroku/Production
The `Procfile` has been updated to:
```
worker: python main.py
```

## Benefits of New Structure

1. **Better Organization**: Related code is grouped together
2. **Easier Maintenance**: Clear separation of concerns
3. **Improved Readability**: Smaller, focused files
4. **Easier Testing**: Modular structure enables unit testing
5. **Scalability**: Easy to add new routes or commands
6. **Team Collaboration**: Multiple developers can work on different modules

## No Functional Changes

This reorganization **preserves all functionality** from the original `jokicguess.py`. It's purely a structural improvement with no changes to:
- API endpoints
- Discord commands
- Database schema
- Business logic
- Dependencies

## Rollback

If needed, you can rollback by:
1. Renaming `jokicguess_backup.py` to `jokicguess.py`
2. Updating `Procfile` back to `worker: python jokicguess.py`
3. Removing the new files
