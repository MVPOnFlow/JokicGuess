# JokicGuess

A fan-powered web app and Discord bot celebrating Nikola Jokic and NBA TopShot moments on the Flow blockchain.

## Overview

JokicGuess is an integrated platform that combines:
- **Web Application**: React SPA with Flask backend serving NBA stats, leaderboards, and Flow blockchain integrations
- **Discord Bot**: Interactive bot with slash commands for contests, trivia, and community engagement
- **Flow Blockchain**: Integration with NBA TopShot moments and Flow ecosystem

The application runs as a single Python process hosting both the Flask API server and Discord bot, sharing a unified database connection.

## Features

### Web Application
- **Home**: Tokenomics overview and treasury information
- **Swapfest**: Leaderboard and event tracking for Flow-based contests
- **FastBreak**: Contest management and statistics
- **TD Watch**: Nikola Jokic triple-double tracking with NBA schedule
- **Horse Stats**: Horse race contest analytics
- **Treasury**: Detailed treasury and token economics dashboard
- **Vote**: Community voting interface

### Discord Bot Commands
- **Contest Commands**: Manage and participate in various contests
- **FastBreak Commands**: Track and interact with FastBreak events
- **Petting Commands**: Fun petting zoo interactions
- **Swapfest Commands**: Swapfest event participation and tracking
- **TD Watch Commands**: Triple-double predictions and tracking
- **General Commands**: Leaderboards, stats, and utility functions

### Flow Blockchain Integration
- NBA TopShot moment tracking
- Flow wallet interactions
- Event monitoring and automation via `swapfest.py`

## Tech Stack

### Backend
- **Python 3.9+**
- **Flask**: Web framework and API server
- **discord.py**: Discord bot framework
- **flow-py-sdk**: Flow blockchain integration
- **SQLite/PostgreSQL**: Database (SQLite locally, PostgreSQL on Heroku)

### Frontend
- **React 18**: UI framework
- **Vite**: Build tool and dev server
- **Bootstrap 5**: CSS framework
- **React Router**: Client-side routing

## Project Structure

```
JokicGuess/
├── jokicguess.py           # Main application entry point
├── swapfest.py            # Flow blockchain event logic
├── config.py              # Configuration management
├── bot/                   # Discord bot commands
│   ├── commands.py
│   ├── contest_commands.py
│   ├── fastbreak_commands.py
│   ├── petting_commands.py
│   ├── swapfest_commands.py
│   └── tdwatch_commands.py
├── routes/                # Flask API routes
│   └── api.py
├── db/                    # Database initialization and connection
│   ├── init.py
│   └── connection.py
├── utils/                 # Helper functions and utilities
│   └── helpers.py
├── react-wallet/          # React frontend source
│   └── src/
│       ├── pages/
│       └── App.jsx
├── react-build/           # Production React build (served by Flask)
├── templates/             # Jinja2 templates (legacy)
├── static/                # Static assets
└── tests/                 # Test suite
```

## Installation

### Prerequisites
- Python 3.9 or higher
- Node.js 16+ and npm
- Git

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/bogdang989/JokicGuess.git
   cd JokicGuess
   ```

2. **Set up Python environment**
   ```bash
   python -m venv venv
   # Windows
   .\venv\Scripts\activate
   # Linux/Mac
   source venv/bin/activate
   
   pip install -r requirements.txt
   ```

3. **Configure environment variables**
   - Create a `secret.txt` file with your Discord bot token, or
   - Set `DISCORD_TOKEN` environment variable
   - For PostgreSQL: Set `DATABASE_URL` (optional, defaults to SQLite)

4. **Initialize database**
   ```bash
   python jokicguess.py
   ```
   The database will be automatically initialized on first run.

5. **Set up React frontend (optional for development)**
   ```bash
   cd react-wallet
   npm install
   npm run dev
   ```

6. **Run the application**
   ```bash
   python jokicguess.py
   ```
   - Flask server runs on `http://localhost:5000`
   - React dev server (if running separately) on `http://localhost:5173`

## Building for Production

### Build React Frontend
```bash
cd react-wallet
npm run build
```
This outputs production assets to `react-build/` which Flask serves automatically.

### Deploy to Heroku
The project includes a `Procfile` and `Dockerfile` for Heroku deployment:
```bash
git push heroku main
```

Set the following config vars on Heroku:
- `DISCORD_TOKEN`: Your Discord bot token
- `DATABASE_URL`: Automatically set by Heroku Postgres addon

## Development Workflow

### Running Locally
- **Backend only**: `python jokicguess.py`
- **Frontend dev mode**: `cd react-wallet && npm run dev`
- **Full stack**: Run both commands in separate terminals

### Testing
```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=. --cov-report=html

# Run specific test file
pytest tests/test_bot_commands.py
```

### Database
- **Local**: Uses `local.db` (SQLite) automatically created in project root
- **Production**: Set `DATABASE_URL` for PostgreSQL connection

## Configuration

### Environment Variables
- `DISCORD_TOKEN`: Discord bot authentication token (required)
- `DATABASE_URL`: PostgreSQL connection string (optional, defaults to SQLite)
- `PORT`: Server port (default: 5000)

### Flow Blockchain
Flow configuration is in `react-wallet/src/flow/config.js`. Update network settings and contract addresses as needed.

## API Endpoints

- `GET /api/leaderboard` - Swapfest leaderboard data
- `GET /api/treasury` - Treasury and tokenomics info
- `GET /api/fastbreak/*` - FastBreak contest endpoints
- Additional endpoints defined in `routes/api.py`

## Discord Bot Usage

After inviting the bot to your server, use slash commands:
- `/leaderboard` - View contest leaderboards
- `/stats` - Check your stats
- `/tdwatch` - Triple-double predictions and tracking
- And many more (see `bot/` modules)

## Data Sources

### TD Watch Schedule & Leaders
- **Nuggets Schedule**: Synced from [Nikola Jokić's Basketball Reference game log](https://www.basketball-reference.com/players/j/jokicni01/gamelog/2026)
- **All-Time Triple-Double Leaders**: Updated from [Basketball Reference career leaders](https://www.basketball-reference.com/leaders/trp_dbl_career.html)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Testing

See `TESTING.md` and `TESTING_CHECKLIST.md` for comprehensive testing guidelines.

## License

This project is open source and available for community use.

## Support

For issues, questions, or contributions, please open an issue on GitHub or reach out via Discord.

## Acknowledgments

- NBA TopShot and Flow blockchain community
- Nikola Jokic fans worldwide
- Discord.py and Flask communities