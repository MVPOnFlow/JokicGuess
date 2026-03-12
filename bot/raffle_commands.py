"""Raffle commands for Discord bot."""

import time
import discord
from discord import app_commands

from utils.helpers import prepare_query, is_admin
from db.init import get_bot_db


def register_raffle_commands(bot, conn, cursor, db_type):
    """Register raffle-related slash commands."""

    @bot.tree.command(
        name="create_raffle",
        description="Admin only: Create a new raffle."
    )
    @app_commands.describe(
        name="Raffle name",
        description="Short description of the raffle prize",
        num_winners="How many winners to draw (default: 3 for DEFAULT type)",
        end_time="End time as a Unix timestamp (seconds)",
        raffle_type="DEFAULT (auto-payout 50/30/15%) or CUSTOM (manual prizes)"
    )
    @app_commands.choices(raffle_type=[
        app_commands.Choice(name='DEFAULT – auto payout 50/30/15%', value='DEFAULT'),
        app_commands.Choice(name='CUSTOM – manual / no auto-payout', value='CUSTOM'),
    ])
    async def create_raffle(
        interaction: discord.Interaction,
        name: str,
        description: str,
        end_time: int,
        raffle_type: str = 'DEFAULT',
        num_winners: int = 3,
    ):
        if not is_admin(interaction):
            await interaction.response.send_message(
                "You need admin permissions to run this command.",
                ephemeral=True
            )
            return

        now = int(time.time())
        if end_time <= now:
            await interaction.response.send_message(
                "End time must be in the future.",
                ephemeral=True
            )
            return

        if num_winners < 1:
            await interaction.response.send_message(
                "Number of winners must be at least 1.",
                ephemeral=True
            )
            return

        # DEFAULT type always uses 3 winners
        if raffle_type == 'DEFAULT':
            num_winners = 3

        conn, cursor = get_bot_db(bot)

        try:
            cursor.execute(prepare_query('''
                INSERT INTO raffles (name, description, num_winners, end_time, status, raffle_type, created_at)
                VALUES (?, ?, ?, ?, 'OPEN', ?, ?)
            '''), (name, description, num_winners, end_time, raffle_type, now))
            conn.commit()

            end_dt = time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime(end_time))

            embed = discord.Embed(
                title="🎟️ Raffle Created",
                color=0xFDB927,
            )
            embed.add_field(name="Name", value=name, inline=False)
            embed.add_field(name="Description", value=description, inline=False)
            embed.add_field(name="Type", value=raffle_type, inline=True)
            embed.add_field(name="Winners", value=str(num_winners), inline=True)
            embed.add_field(name="Ends", value=end_dt, inline=True)
            embed.add_field(name="Entry cost", value="1 $MVP per entry", inline=True)
            if raffle_type == 'DEFAULT':
                embed.add_field(name="Payouts", value="1st: 50% | 2nd: 30% | 3rd: 15%", inline=False)
            embed.set_footer(text="MVP on Flow • Raffles")

            await interaction.response.send_message(embed=embed)

        except Exception as e:
            await interaction.response.send_message(
                f"Error creating raffle: {e}",
                ephemeral=True
            )
