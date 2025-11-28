"""TD Watch commands for Discord bot - Manage Jokic's triple-double milestone tracking.

NOTE: Schedule and prize packs are now hardcoded in the React component.
Update react-wallet/src/pages/TDWatch.jsx manually to keep data current.

This module is kept for potential future Discord integration but commands are removed.
"""

import discord
from discord.ext import commands
from discord import app_commands
from typing import Optional

from utils.helpers import prepare_query, is_admin


def register_tdwatch_commands(bot, conn, cursor, db_type):
    """Register TD Watch commands (currently none - data is hardcoded in frontend)."""
    # No commands registered - schedule and packs are hardcoded in React component
    # To update data, edit react-wallet/src/pages/TDWatch.jsx directly
    pass
