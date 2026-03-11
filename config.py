"""Configuration constants for JokicGuess application."""

import os
from dotenv import load_dotenv

load_dotenv()  # loads .env file (gitignored) for local dev

# Swapfest event timings (UTC) format 2025-11-24T05:10:56.167Z
SWAPFEST_START_TIME = '2025-12-09T22:00:00.000Z'
SWAPFEST_END_TIME = '2026-01-18T22:00:01.000Z'
SWAPFEST_BOOST1_CUTOFF = '2025-10-17T00:00:00.000Z'  # 1.4x before this
SWAPFEST_BOOST2_CUTOFF = '2025-10-21T00:00:00.000Z'  # 1.2x before this

# Discord channel configuration
PETTING_ALLOWED_CHANNEL_ID = 1333948717824475187  # Petting allowed channel ID or thread ID

# Petting rewards configuration
DEFAULT_FREE_DAILY_PETS = 1  # Daily free pets for each user
SPECIAL_REWARD_NAME = "Grail seeker pack"  # Special rewards
SPECIAL_REWARD_ODDS = 1 / 200

# Flow blockchain configuration
# Treasury Dapper wallet – receives TopShot moments from swap users (also used by Swapfest)
FLOW_ACCOUNT = "0xf853bd09d46e7db6"

# Treasury Flow wallet – sends $MVP to swap users
FLOW_SWAP_ACCOUNT = "0xcc4b6fa5550a4610"
FLOW_SWAP_PRIVATE_KEY = os.getenv('FLOW_SWAP_PRIVATE_KEY', '')  # Hex private key for swap tx signing
FLOW_SWAP_KEY_INDEX = int(os.getenv('FLOW_SWAP_KEY_INDEX', '1'))  # Key index on the swap account
FLOW_SCAN_API_URL = os.getenv('FLOW_SCAN_API_URL', '')

# Database configuration
DATABASE_URL = os.getenv('DATABASE_URL')  # PostgreSQL URL

# Discord bot configuration
DISCORD_TOKEN = os.getenv('DISCORD_TOKEN')

# Flask configuration
FLASK_HOST = "0.0.0.0"
FLASK_PORT = 8000

# Treasury data
TREASURY_DATA = {
    "tokens_in_wild": 11807,
    "common_count": 2514,
    "rare_count": 101,
    "tsd_count": 0,
    "lego_count": 0,
    "last_updated": "2026-03-12 15:00 UTC"
}
