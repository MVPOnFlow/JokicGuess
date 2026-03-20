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

# Horse names for Swapboost NFTs (1-50)
# Display as "<name> #<id>" on the NFT page
HORSE_NAMES = {
    1:  "Dreamcatcher",
    2:  "Sombor Star",
    3:  "Big Honey",
    4:  "Midnight Run",
    5:  "Silver Thunder",
    6:  "Balkan Spirit",
    7:  "Golden Mane",
    8:  "Storm Chaser",
    9:  "Noble Heart",
    10: "Shadow Dancer",
    11: "Prairie Wind",
    12: "Thunderbolt",
    13: "Velvet Rush",
    14: "Starlight Express",
    15: "Dark Horse",
    16: "Painted Sky",
    17: "Diamond Dust",
    18: "Copper Coin",
    19: "Rolling Thunder",
    20: "Iron Will",
    21: "Lucky Strike",
    22: "Crimson Tide",
    23: "Blazing Trail",
    24: "High Noon",
    25: "Champion's Pride",
    26: "Steel Magnolia",
    27: "Silver Bullet",
    28: "Northern Lights",
    29: "Gentle Giant",
    30: "Gold Rush",
    31: "Whispering Wind",
    32: "Iron Horse",
    33: "Night Rider",
    34: "Royal Flush",
    35: "Spirit Runner",
    36: "Sunset Ridge",
    37: "Brave Heart",
    38: "Maverick",
    39: "Lightning Bolt",
    40: "Victory Lap",
    41: "Joker's Wild",
    42: "Mile High",
    43: "Triple Double",
    44: "Nugget",
    45: "Wild Card",
    46: "Rapid Fire",
    47: "Mustang Sally",
    48: "Blue Ribbon",
    49: "Desert Storm",
    50: "Trotter King",
}

# ── Reward Pool ──────────────────────────────────────────────────────
# Each entry: {"name": str, "quantity": int, "tier": str, "type": str}
#   tier  – visual badge: "common", "fandom", "rare", "legendary", "special"
#   type  – "pack" | "nft" | "petting" | "wildcard"
REWARD_POOL = [
    # ── Sealed TopShot Packs ──────────────────────────────────
    {"name": "Chase Cooper Flagg and Kon Knueppel Rookies",           "quantity": 1, "tier": "common",    "type": "pack"},
    {"name": "Bam Adebayo Top Shot This",                             "quantity": 1, "tier": "fandom",    "type": "pack"},
    {"name": "SGA TopShot This",                                      "quantity": 1, "tier": "fandom",    "type": "pack"},
    {"name": "Fast Break 25-26' Classic Run 5 – 4 Wins Pack",         "quantity": 1, "tier": "common",    "type": "pack"},
    {"name": "Rookie Debut Standard Pack",                            "quantity": 1, "tier": "common",    "type": "pack"},
    {"name": "Collector Series: Grail Chase",                         "quantity": 2, "tier": "common",    "type": "pack"},
    {"name": "Fast Break 25-26' Classic Run 2 – 4 Wins Pack",         "quantity": 1, "tier": "common",    "type": "pack"},
    {"name": "Rookie Debut: Chance Hit",                              "quantity": 3, "tier": "common",    "type": "pack"},
    {"name": "NBA Stars: The National Exclusive Chase Pack",          "quantity": 3, "tier": "common",    "type": "pack"},
    {"name": "Run It Back: Origins August",                           "quantity": 1, "tier": "rare",      "type": "pack"},
    {"name": "Gabe Vincent 2023 NBA Finals",                          "quantity": 1, "tier": "common",    "type": "pack"},
    # ── Non-pack Rewards ──────────────────────────────────────
    {"name": "$MVP Horse NFT",                                        "quantity": 3, "tier": "legendary", "type": "nft"},
    {"name": "Pet your horse 10 times",                               "quantity": 10, "tier": "special",   "type": "petting"},
    {"name": "Jolly Joker NFT",                                       "quantity": 1, "tier": "legendary", "type": "nft"},
]

# Treasury data
TREASURY_DATA = {
    "tokens_in_wild": 11807,
    "common_count": 2514,
    "rare_count": 101,
    "tsd_count": 0,
    "lego_count": 0,
    "last_updated": "2026-03-12 15:00 UTC"
}
