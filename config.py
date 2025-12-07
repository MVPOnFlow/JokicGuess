"""Configuration constants for JokicGuess application."""

import os

# Swapfest event timings (UTC) format 2025-11-24T05:10:56.167Z
SWAPFEST_START_TIME = '2025-11-27T22:00:00.000Z'
SWAPFEST_END_TIME = '2025-12-08T22:00:01.000Z'
SWAPFEST_BOOST1_CUTOFF = '2025-10-17T00:00:00.000Z'  # 1.4x before this
SWAPFEST_BOOST2_CUTOFF = '2025-10-21T00:00:00.000Z'  # 1.2x before this

# Discord channel configuration
PETTING_ALLOWED_CHANNEL_ID = 1333948717824475187  # Petting allowed channel ID or thread ID

# Petting rewards configuration
DEFAULT_FREE_DAILY_PETS = 1  # Daily free pets for each user
SPECIAL_REWARD_NAME = "Grail seeker pack"  # Special rewards
SPECIAL_REWARD_ODDS = 1 / 200

# Flow blockchain configuration
FLOW_ACCOUNT = "0xf853bd09d46e7db6"

# Database configuration
DATABASE_URL = os.getenv('DATABASE_URL')  # Heroku PostgreSQL URL

# Discord bot configuration
DISCORD_TOKEN = os.getenv('DISCORD_TOKEN')

# Flask configuration
FLASK_HOST = "0.0.0.0"
FLASK_PORT = 8000

# Treasury data
TREASURY_DATA = {
    "tokens_in_wild": 15159,
    "common_count": 2411,
    "rare_count": 134,
    "tsd_count": 0,
    "lego_count": 1,
    "last_updated": "2025-12-07 15:00 UTC"
}
