"""Configuration constants for JokicGuess application."""

import os

# Swapfest event timings (UTC)
SWAPFEST_START_TIME = '2025-10-23 21:00:00'
SWAPFEST_END_TIME = '2025-11-24 00:00:00'
SWAPFEST_BOOST1_CUTOFF = '2025-10-17 00:00:00'  # 1.4x before this
SWAPFEST_BOOST2_CUTOFF = '2025-10-21 00:00:00'  # 1.2x before this

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
