"""Discord bot command orchestration - imports and registers all command modules."""

from bot.contest_commands import register_contest_commands
from bot.petting_commands import register_petting_commands
from bot.fastbreak_commands import register_fastbreak_commands
from bot.swapfest_commands import register_swapfest_commands


def register_commands(bot, conn, cursor, db_type):
    """Register all Discord bot slash commands from separated modules."""
    register_contest_commands(bot, conn, cursor, db_type)
    register_petting_commands(bot, conn, cursor, db_type)
    register_fastbreak_commands(bot, conn, cursor, db_type)
    register_swapfest_commands(bot, conn, cursor, db_type)

