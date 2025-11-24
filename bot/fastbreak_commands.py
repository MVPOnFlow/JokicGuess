"""FastBreak contest commands for Discord bot."""

import discord
from discord.ext import commands
from discord import app_commands
import io
import json

from utils.helpers import (
    prepare_query, is_admin, extract_fastbreak_runs,
    pull_rankings_for_fb
)


def register_fastbreak_commands(bot, conn, cursor, db_type):
    """Register FastBreak contest commands."""

    @bot.tree.command(name="list_active_fastbreak_runs", description="Admin only: Dump all active FastBreak runs as JSON file")
    @app_commands.checks.has_permissions(administrator=True)
    async def list_active_fastbreak_runs(interaction: discord.Interaction):
        await interaction.response.defer()

        if not is_admin(interaction):
            await interaction.response.send_message(
                "You need admin permissions to run this command.",
                ephemeral=True
            )
            return
        try:
            runs = extract_fastbreak_runs()
            json_data = json.dumps(runs, indent=2)
            buffer = io.BytesIO(json_data.encode('utf-8'))
            buffer.seek(0)
            discord_file = discord.File(fp=buffer, filename="fastbreak_runs.json")

            await interaction.followup.send(
                content="Here is the full FastBreak runs JSON:",
                file=discord_file,
                ephemeral=True
            )

        except Exception as e:
            await interaction.followup.send(f"Error: {e}", ephemeral=True)

    @bot.tree.command(
        name="create_fastbreak_contest",
        description="Admin only: Create a new FastBreak contest."
    )
    @commands.has_permissions(administrator=True)
    async def create_fastbreak_contest(
        interaction: discord.Interaction,
        fastbreak_id: str,
        display_name: str,
        lock_timestamp: str,
        buy_in_currency: str = 'MVP',
        buy_in_amount: float = 5.0
    ):
        if not is_admin(interaction):
            await interaction.response.send_message(
                "You need admin permissions to run this command.",
                ephemeral=True
            )
            return

        try:
            cursor.execute(prepare_query('''
                INSERT INTO fastbreakContests (
                    fastbreak_id, display_name, lock_timestamp, buy_in_currency, buy_in_amount
                ) VALUES (?, ?, ?, ?, ?)
            '''), (
                fastbreak_id,
                display_name,
                lock_timestamp,
                buy_in_currency,
                buy_in_amount
            ))
            conn.commit()

            await interaction.response.send_message(
                f"✅ Contest created!\n"
                f"FastBreak ID: **{fastbreak_id}**\n"
                f"Display name: **{display_name}**\n"
                f"Lock Timestamp: **{lock_timestamp}**\n"
                f"Buy-In: **{buy_in_amount} {buy_in_currency}**",
                ephemeral=True
            )

        except Exception as e:
            print(f"Error creating contest: {e}")
            await interaction.response.send_message(
                "❌ Failed to create contest. Please try again.",
                ephemeral=True
            )

    @bot.tree.command(
        name="close_fastbreak_contest",
        description="Admin only: Close a FastBreak contest."
    )
    @commands.has_permissions(administrator=True)
    async def close_fastbreak_contest(
            interaction: discord.Interaction,
            contest_id: int
    ):
        if not is_admin(interaction):
            await interaction.response.send_message(
                "You need admin permissions to run this command.",
                ephemeral=True
            )
            return

        try:
            cursor.execute(prepare_query('''
                UPDATE fastbreakContests
                SET status = 'CLOSED'
                WHERE id = ?
            '''), (contest_id,))
            conn.commit()

            await interaction.response.send_message(
                f"✅ Contest {contest_id} has been closed.",
                ephemeral=True
            )
        except Exception as e:
            print(f"Error closing contest: {e}")
            await interaction.response.send_message(
                "❌ Failed to close contest. Please try again.",
                ephemeral=True
            )

    @bot.tree.command(name="pull_fastbreak_horse_stats", description="Admin only: Pull and store new FastBreaks and their rankings.")
    @app_commands.checks.has_permissions(administrator=True)
    async def pull_fastbreak_horse_stats(interaction: discord.Interaction, fb_id: str):
        await interaction.response.defer(ephemeral=True)

        if not is_admin(interaction):
            await interaction.followup.send("You need admin permissions to run this command.", ephemeral=True)
            return

        new_fastbreaks = []
        new_rankings_count = 0

        runs = extract_fastbreak_runs()

        for run in runs[:7]:
            if not run['fastBreaks'] or run['runName'].endswith('Pro'):
                continue
            run_name = run.get('runName', '')
            for fb in run.get('fastBreaks', []):
                if not fb or fb.get('status') != 'FAST_BREAK_FINISHED':
                    continue

                if fb_id == fb.get('id'):
                    game_date = fb.get('gameDate')
                    status = fb.get('status')

                    cursor.execute(prepare_query('SELECT 1 FROM fastbreaks WHERE id = ?'), (fb_id,))

                    cursor.execute(prepare_query('''
                        INSERT INTO fastbreaks (id, game_date, run_name, status)
                        VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING
                    '''), (fb_id, game_date, run_name, status))
                    conn.commit()
                    new_fastbreaks.append({
                        'id': fb_id,
                        'game_date': game_date,
                        'run_name': run_name
                    })

                    new_rankings_count += len(pull_rankings_for_fb(fb_id))
                    print(f"✅ FastBreak {fb_id} stored with {new_rankings_count} rankings.")

        cursor.execute("REFRESH MATERIALIZED VIEW user_rankings_summary")
        conn.commit()

        await interaction.followup.send(
            f"✅ Pulled {len(new_fastbreaks)} new finished FastBreaks and {new_rankings_count} total rankings.",
            ephemeral=True
        )
