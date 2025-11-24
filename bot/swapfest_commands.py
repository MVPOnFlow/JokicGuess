"""Swapfest gift and leaderboard commands for Discord bot."""

import discord
from discord.ext import commands
from discord import app_commands
import io
import csv
from datetime import datetime

from utils.helpers import prepare_query, is_admin, map_wallet_to_username, get_last_processed_block, save_gift
from config import SWAPFEST_START_TIME, SWAPFEST_END_TIME, SWAPFEST_BOOST1_CUTOFF, SWAPFEST_BOOST2_CUTOFF


def register_swapfest_commands(bot, conn, cursor, db_type):
    """Register Swapfest gift tracking and leaderboard commands."""

    @bot.tree.command(
        name="gift_leaderboard",
        description="Show Swapfest leaderboard by total gifted points in event period"
    )
    async def gift_leaderboard(interaction: discord.Interaction):
        # Define the event window in UTC
        start_time = SWAPFEST_START_TIME
        end_time   = SWAPFEST_END_TIME

        # Multiplier cutoffs (UTC)
        boost1_cutoff = SWAPFEST_BOOST1_CUTOFF
        boost2_cutoff = SWAPFEST_BOOST2_CUTOFF

        # Query with date-based multipliers:
        # - < Sept 04 => 1.4x
        # - < Sept 15 => 1.2x
        # - otherwise 1.0x
        cursor.execute(prepare_query('''
            SELECT
                from_address,
                SUM(points * CASE
                    WHEN timestamp < ? THEN 1.4
                    WHEN timestamp < ? THEN 1.2
                    ELSE 1.0
                END) AS total_points
            FROM gifts
            WHERE timestamp BETWEEN ? AND ?
            GROUP BY from_address
            ORDER BY total_points DESC
            LIMIT 20
        '''), (boost1_cutoff, boost2_cutoff, start_time, end_time))
        rows = cursor.fetchall()

        if not rows:
            await interaction.response.send_message(
                "No gift records found in the event period.",
                ephemeral=True
            )
            return

        # Format leaderboard with wallet-to-username mapping
        leaderboard_lines = ["🎁 **Swapfest Gift Leaderboard** 🎁"]
        leaderboard_lines.append(
            f"_Between {start_time} UTC and {end_time} UTC_"
            f"\n_1.4× before {boost1_cutoff} • 1.2× before {boost2_cutoff}_\n"
        )
        for i, (from_address, total_points) in enumerate(rows, start=1):
            username = map_wallet_to_username(from_address)
            # If you prefer whole numbers, swap to: int(round(total_points))
            leaderboard_lines.append(f"{i}. `{username}` : **{total_points:.2f} points**")

        message = "\n".join(leaderboard_lines)
        await interaction.response.send_message(message, ephemeral=True)

    @bot.tree.command(name="swapfest_latest_block", description="Check the last processed blockchain block scraping swapfest gifts (Admin only)")
    @commands.has_permissions(administrator=True)
    async def latest_block(interaction: discord.Interaction):
        # Check if the user is an admin
        if not is_admin(interaction):
            await interaction.response.send_message(
                "You need admin permissions to run this command.",
                ephemeral=True
            )
            return

        # Call your helper function
        last_block = get_last_processed_block()

        if last_block is None:
            await interaction.response.send_message(
                "⚠️ No processed block found.",
                ephemeral=True
            )
            return

        # Respond with the block number
        await interaction.response.send_message(
            f"🧱 **Last processed block:** {last_block}",
            ephemeral=True
        )

    @bot.tree.command(
        name="add_gift_swapfest",
        description="(Admin only) Manually add a swapfest gift to the database"
    )
    @commands.has_permissions(administrator=True)
    async def add_gift(
        interaction: discord.Interaction,
        txn_id: str,
        moment_id: int,
        from_address: str,
        points: int,
        timestamp: str
    ):
        # ✅ Check admin (if you have a custom checker)
        if not is_admin(interaction):
            await interaction.response.send_message(
                "You need admin permissions to run this command.",
                ephemeral=True
            )
            return

        try:
            # ✅ Call your helpers.py function
            save_gift(txn_id, moment_id, from_address, points, timestamp)

            # ✅ Respond with success
            await interaction.response.send_message(
                f"✅ Gift added:\n- txn_id: {txn_id}\n- moment_id: {moment_id}\n- from: {from_address}\n- points: {points}\n- timestamp: {timestamp}",
                ephemeral=True
            )

        except Exception as e:
            # ✅ Error handling
            await interaction.response.send_message(
                f"❌ Failed to add gift: {e}",
                ephemeral=True
            )

    @bot.tree.command(
        name="latest_gifts_csv",
        description="(Admin only) List the latest gifts in CSV format (optionally filter by username)"
    )
    @commands.has_permissions(administrator=True)
    async def latest_gifts_csv(
        interaction: discord.Interaction,
        from_address: str | None = None
    ):
        # ✅ Check admin
        if not is_admin(interaction):
            await interaction.response.send_message(
                "You need admin permissions to run this command.",
                ephemeral=True
            )
            return

        # ✅ Build query dynamically
        if from_address:
            query = prepare_query('''
                SELECT txn_id, moment_id, from_address, points, timestamp
                FROM gifts
                WHERE from_address = ?
                ORDER BY timestamp DESC
                LIMIT 10
            ''')
            cursor.execute(query, (from_address,))
        else:
            query = prepare_query('''
                SELECT txn_id, moment_id, from_address, points, timestamp
                FROM gifts
                ORDER BY timestamp DESC
                LIMIT 10
            ''')
            cursor.execute(query)

        rows = cursor.fetchall()

        if not rows:
            await interaction.response.send_message(
                "No gifts found in the database.",
                ephemeral=True
            )
            return

        # ✅ Build CSV
        csv_lines = ["txn_id,moment_id,from_address,points,timestamp"]

        for txn_id, moment_id, from_address, points, timestamp in rows:
            display_name = map_wallet_to_username(from_address)
            csv_line = f"{txn_id},{moment_id},{display_name},{points},{timestamp}"
            csv_lines.append(csv_line)

        csv_text = "\n".join(csv_lines)
        message_content = f"```csv\n{csv_text}\n```"

        await interaction.response.send_message(message_content, ephemeral=True)

    @bot.tree.command(
        name="swapfest_refresh_points",
        description="(Admin only) Re-scan gifts with 0 points and refresh their scoring"
    )
    @commands.has_permissions(administrator=True)
    async def swapfest_refresh_points(interaction: discord.Interaction):
        # Admin check
        if not is_admin(interaction):
            await interaction.response.send_message(
                "You need admin permissions to run this command.",
                ephemeral=True
            )
            return

        await interaction.response.send_message(
            "🔄 Refreshing points for gifts with 0 points. This may take a while...", 
            ephemeral=True
        )
        
        # Import at function level to avoid circular dependencies
        import swapfest
        from config import FLOW_ACCOUNT

        # 1️⃣ Find all gifts with 0 points
        cursor.execute(prepare_query('''
            SELECT txn_id, moment_id, from_address
            FROM gifts
            WHERE COALESCE(points, 0) = 0
        '''))
        rows = cursor.fetchall()

        if not rows:
            await interaction.followup.send(
                "✅ No gifts with 0 points found.",
                ephemeral=True
            )
            return

        updated_count = 0

        # 2️⃣ Process each gift
        for txn_id, moment_id, from_address in rows:
            await interaction.followup.send(
                f"✅ Refreshing points for {moment_id}.",
                ephemeral=True
            )
            new_points = await swapfest.get_moment_points(FLOW_ACCOUNT, int(moment_id))
            if new_points > 0:
                await interaction.followup.send(
                    f"✅ Refreshing points for {moment_id}: {new_points}.",
                    ephemeral=True
                )
                # Update the points in DB
                cursor.execute(prepare_query('''
                    UPDATE gifts
                    SET points = ?
                    WHERE txn_id = ?
                '''), (new_points, txn_id))
                updated_count += 1
                conn.commit()

        # 3️⃣ Report result
        await interaction.followup.send(
            f"✅ Refreshed points for {updated_count} gifts.",
            ephemeral=True
        )
