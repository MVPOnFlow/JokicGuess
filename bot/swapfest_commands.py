"""Swapfest gift and leaderboard commands for Discord bot."""

import discord
from discord.ext import commands
from discord import app_commands
import io
import csv
from datetime import datetime

from utils.helpers import prepare_query, is_admin, map_wallet_to_username


def register_swapfest_commands(bot, conn, cursor, db_type):
    """Register Swapfest gift tracking and leaderboard commands."""

    @bot.tree.command(name="gift_leaderboard", description="Show the top 10 gifters for Swapfest")
    async def gift_leaderboard(interaction: discord.Interaction):
        await interaction.response.defer()

        try:
            cursor.execute(prepare_query('''
                SELECT flowAddress, SUM(quantity * estimated_price_usd) as total_value
                FROM swapfest_gifts
                GROUP BY flowAddress
                ORDER BY total_value DESC
                LIMIT 10
            '''))
            rows = cursor.fetchall()

            if not rows:
                await interaction.followup.send("No gifts tracked yet for Swapfest!", ephemeral=True)
                return

            embed = discord.Embed(
                title="🎁 Swapfest Gift Leaderboard (Top 10)",
                description="Based on estimated USD value of gifts sent",
                color=discord.Color.gold()
            )

            for idx, row in enumerate(rows, start=1):
                address = row[0]
                value = row[1] or 0
                embed.add_field(
                    name=f"{idx}. {address[:8]}...{address[-4:]}",
                    value=f"${value:.2f}",
                    inline=False
                )

            await interaction.followup.send(embed=embed)

        except Exception as e:
            await interaction.followup.send(f"Error fetching leaderboard: {e}", ephemeral=True)

    @bot.tree.command(name="swapfest_latest_block", description="Show the latest block height stored for Swapfest gifts")
    async def swapfest_latest_block(interaction: discord.Interaction):
        try:
            cursor.execute(prepare_query('''
                SELECT MAX(blockHeight) FROM swapfest_gifts
            '''))
            result = cursor.fetchone()
            max_block = result[0] if result and result[0] else 0

            await interaction.response.send_message(
                f"📦 Latest block height in DB: **{max_block}**",
                ephemeral=True
            )
        except Exception as e:
            await interaction.response.send_message(f"Error: {e}", ephemeral=True)

    @bot.tree.command(name="add_gift_swapfest", description="Admin only: Pull gifts from a block range and store them.")
    @app_commands.checks.has_permissions(administrator=True)
    async def add_gift_swapfest(
        interaction: discord.Interaction,
        start_block: int,
        end_block: int
    ):
        await interaction.response.defer(ephemeral=True)

        if not is_admin(interaction):
            await interaction.followup.send("You need admin permissions to run this command.", ephemeral=True)
            return

        try:
            # This is a placeholder - actual implementation would query Flow blockchain
            # For now, just return a message
            await interaction.followup.send(
                f"⚠️ This command needs implementation for pulling gifts from blocks {start_block} to {end_block}.",
                ephemeral=True
            )

        except Exception as e:
            await interaction.followup.send(f"Error: {e}", ephemeral=True)

    @bot.tree.command(name="latest_gifts_csv", description="Admin only: Download all Swapfest gifts as CSV")
    @app_commands.checks.has_permissions(administrator=True)
    async def latest_gifts_csv(interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)

        if not is_admin(interaction):
            await interaction.followup.send("You need admin permissions to run this command.", ephemeral=True)
            return

        try:
            # Query all gifts from the database
            cursor.execute(prepare_query('''
                SELECT txn_id, moment_id, from_address, points, timestamp
                FROM gifts
                ORDER BY timestamp DESC
                LIMIT 100
            '''))
            rows = cursor.fetchall()

            if not rows:
                await interaction.followup.send("No gifts to export.", ephemeral=True)
                return

            # Create CSV content
            buffer = io.StringIO()
            buffer.write("txn_id,moment_id,from_address,points,timestamp\n")
            
            for txn_id, moment_id, from_address, points, timestamp in rows:
                display_name = map_wallet_to_username(from_address)
                buffer.write(f"{txn_id},{moment_id},{display_name},{points},{timestamp}\n")

            buffer.seek(0)
            csv_bytes = io.BytesIO(buffer.getvalue().encode('utf-8'))
            csv_bytes.seek(0)

            discord_file = discord.File(fp=csv_bytes, filename="swapfest_gifts.csv")

            await interaction.followup.send(
                content=f"📊 Exported {len(rows)} gifts to CSV:",
                file=discord_file,
                ephemeral=True
            )

        except Exception as e:
            await interaction.followup.send(f"Error: {e}", ephemeral=True)

    @bot.tree.command(name="swapfest_refresh_points", description="Admin only: Manually refresh swapfest_points materialized view")
    @app_commands.checks.has_permissions(administrator=True)
    async def swapfest_refresh_points(interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)

        if not is_admin(interaction):
            await interaction.followup.send("You need admin permissions to run this command.", ephemeral=True)
            return

        try:
            cursor.execute("REFRESH MATERIALIZED VIEW swapfest_points")
            conn.commit()

            await interaction.followup.send(
                "✅ Successfully refreshed `swapfest_points` materialized view.",
                ephemeral=True
            )
        except Exception as e:
            await interaction.followup.send(f"Error refreshing view: {e}", ephemeral=True)
