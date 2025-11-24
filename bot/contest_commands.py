"""Contest and prediction commands for Discord bot."""

import discord
from discord.ext import commands
from discord import app_commands
from typing import Literal
import time

from utils.helpers import (
    prepare_query, Outcome, start_contest, save_prediction,
    get_user_predictions_for_contest, get_predictions_for_contest,
    create_predictions_csv, count_total_predictions
)


def register_contest_commands(bot, conn, cursor, db_type):
    """Register contest and prediction commands."""

    @bot.tree.command(name='start', description='Start a contest (Admin only)')
    @commands.has_permissions(administrator=True)
    async def start(interaction: discord.Interaction, name: str, start_time: int):
        channel = interaction.channel
        user = interaction.user

        cursor.execute(prepare_query('SELECT contest_name FROM contests WHERE channel_id = ?'), (channel.id,))
        existing_contest = cursor.fetchone()

        if existing_contest:
            await interaction.response.send_message(
                f"A contest '{existing_contest[0]}' is already active in this channel. Please finish it before starting a new one.",
                ephemeral=True
            )
            return

        start_contest(channel.id, name, start_time, user.id)

        await interaction.response.send_message(
            f"Contest '{name}' started in this channel! Game starts at <t:{start_time}:F>.", ephemeral=True)

    @bot.tree.command(name='predict', description='Predict stats total and game outcome')
    @app_commands.describe(
        stats='Total of 2xPts+3xReb+5xAs+7xStl+9xBlk for the player',
        outcome="Player's team wins or loses the game?",
    )
    async def predict(interaction: discord.Interaction, stats: str, outcome: Literal['Win', 'Loss']):
        user = interaction.user
        channel = interaction.channel

        cursor.execute(prepare_query('SELECT contest_name, start_time FROM contests WHERE channel_id = ?'), (channel.id,))
        contest = cursor.fetchone()

        if contest:
            contest_name, start_time = contest
            current_time = int(time.time())

            if current_time >= int(start_time):
                await interaction.response.send_message("Predictions are closed. The game has already started.",
                                                        ephemeral=True)
                return

            try:
                outcome_enum = Outcome[outcome.upper()]
            except KeyError:
                await interaction.response.send_message("Invalid outcome. Please use 'Win' or 'Loss'.", ephemeral=True)
                return

            save_prediction(user.id, contest_name, stats, outcome_enum, current_time)

            await interaction.response.send_message(
                f"Prediction saved for {user.name} in contest '{contest_name}'.", ephemeral=True
            )
        else:
            await interaction.response.send_message("No active contest in this channel. Please start a contest first.",
                                                    ephemeral=True)

    @bot.tree.command(name='remove_prediction', description='Remove a prediction')
    async def remove_prediction(interaction: discord.Interaction, stats: str, outcome: str):
        user = interaction.user
        channel = interaction.channel

        try:
            outcome_enum = Outcome[outcome.upper()]
        except KeyError:
            await interaction.response.send_message("Invalid outcome. Please use 'Win' or 'Loss'.", ephemeral=True)
            return

        cursor.execute(prepare_query('''
            DELETE FROM predictions
            WHERE user_id = ? AND contest_name = (SELECT contest_name FROM contests WHERE channel_id = ?)
            AND stats = ? AND outcome = ?
        '''), (user.id, channel.id, stats, outcome_enum.value))
        conn.commit()

        if cursor.rowcount > 0:
            await interaction.response.send_message("Prediction removed successfully.", ephemeral=True)
        else:
            predictions = get_user_predictions_for_contest(user.id, channel.id)
            if predictions:
                response = "No such entry. Here are your current predictions:\n"
                for contest_name, stats, outcome, timestamp in predictions:
                    response += f"Contest: {contest_name}, Stats: {stats}, Outcome: {outcome}\n"
            else:
                response = "No such entry. You have no predictions in this contest."

            await interaction.response.send_message(response, ephemeral=True)

    @bot.tree.command(name='predictions', description="List all predictions")
    async def predictions(interaction: discord.Interaction):
        user = interaction.user
        channel = interaction.channel

        query = 'SELECT start_time, creator_id FROM contests WHERE channel_id = ?'
        query = prepare_query(query)
        cursor.execute(query, (channel.id,))
        contest = cursor.fetchone()

        if contest:
            start_time, creator_id = contest

            if int(time.time()) < int(start_time) and user.id != creator_id:
                await interaction.response.send_message("Predictions are hidden until the game starts.", ephemeral=True)
                return

            predictions = get_predictions_for_contest(channel.id)

            if predictions:
                response = ""
                for user_id, stats, outcome, timestamp in predictions:
                    query = 'SELECT username FROM user_mapping WHERE user_id = ?'
                    query = prepare_query(query)
                    cursor.execute(query, (user_id,))
                    result = cursor.fetchone()

                    if result:
                        username = result[0]
                    else:
                        try:
                            user_obj = await bot.fetch_user(user_id)
                            username = user_obj.name
                            if db_type == 'postgresql':
                                query = '''INSERT INTO user_mapping (user_id, username) 
                                           VALUES (%s, %s) 
                                           ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username'''
                            else:
                                query = 'INSERT OR REPLACE INTO user_mapping (user_id, username) VALUES (?, ?)'

                            query = prepare_query(query)
                            cursor.execute(query, (user_id, username))
                            conn.commit()
                        except Exception as e:
                            username = f"User {user_id}"

                    response += f"{username}: Stats: {stats}, Outcome: {outcome}\n"

                if len(response) > 2000:
                    csv_output = await create_predictions_csv(predictions)
                    csv_filename = f"predictions_{channel.id}.csv"
                    discord_file = discord.File(fp=csv_output, filename=csv_filename)
                    await interaction.response.send_message(
                        content="The predictions list is too large. Here is the CSV file.", file=discord_file,
                        ephemeral=True)
                else:
                    await interaction.response.send_message(response, ephemeral=True)
            else:
                await interaction.response.send_message("No predictions have been made for this contest.", ephemeral=True)
        else:
            await interaction.response.send_message("No active contest in this channel.", ephemeral=True)

    @bot.tree.command(name='my_predictions', description='List my predictions')
    async def my_predictions(interaction: discord.Interaction):
        user = interaction.user
        channel = interaction.channel

        predictions = get_user_predictions_for_contest(user.id, channel.id)

        if predictions:
            embed = discord.Embed(title=f"{user.name}'s Predictions in Current Contest", color=discord.Color.blue())
            for contest_name, stats, outcome, timestamp in predictions:
                embed.add_field(name=contest_name, value=f"Stats: {stats}, Outcome: {outcome}", inline=False)
        else:
            embed = discord.Embed(title="No Predictions",
                                  description="You haven't made any predictions for the current contest.",
                                  color=discord.Color.red())

        await interaction.response.send_message(embed=embed, ephemeral=True)

    @bot.tree.command(name='total_predictions', description='Show number of predictions')
    async def total_predictions(interaction: discord.Interaction):
        channel = interaction.channel
        total = count_total_predictions(channel.id)
        await interaction.response.send_message(f"Total predictions made: {total}", ephemeral=True)

    @bot.tree.command(name='winner', description='Declare winner (Admin only)')
    async def winner(interaction: discord.Interaction, stats: int, outcome: str):
        channel = interaction.channel
        user = interaction.user

        if outcome not in ['Win', 'Loss']:
            await interaction.response.send_message("Invalid outcome. Outcome must be 'Win' or 'Loss'.", ephemeral=True)
            return

        query = 'SELECT start_time, creator_id FROM contests WHERE channel_id = ?'
        query = prepare_query(query)
        cursor.execute(query, (channel.id,))
        contest = cursor.fetchone()

        if not contest:
            await interaction.response.send_message("No active contest found for this channel.", ephemeral=True)
            return

        start_time, creator_id = contest

        if user.id != creator_id:
            await interaction.response.send_message("Only the contest creator can declare the winner.", ephemeral=True)
            return

        predictions = get_predictions_for_contest(channel.id)

        if not predictions:
            await interaction.response.send_message("No predictions found for this contest.", ephemeral=True)
            return

        valid_predictions = [p for p in predictions if p[2] == outcome]

        if not valid_predictions:
            await interaction.response.send_message("No predictions with the correct outcome.", ephemeral=True)
            return

        smallest_diff = float('inf')
        winners = []

        for user_id, pred_stats, pred_outcome, timestamp in valid_predictions:
            diff = abs(int(pred_stats) - stats)
            if diff < smallest_diff:
                smallest_diff = diff
                winners = [(user_id, pred_stats, pred_outcome)]
            elif diff == smallest_diff:
                winners.append((user_id, pred_stats, pred_outcome))

        if winners:
            response = f"🎉 **We have a winner** for the contest in **{channel.name}**! 🎉\n"
            response += f"🏆 Congratulations to the following amazing predictor(s):\n\n"

            for winner in winners:
                user_id, winner_stats, winner_outcome = winner

                query = 'SELECT username FROM user_mapping WHERE user_id = ?'
                query = prepare_query(query)
                cursor.execute(query, (user_id,))
                result = cursor.fetchone()

                if result:
                    username = result[0]
                else:
                    try:
                        user_obj = await bot.fetch_user(user_id)
                        username = user_obj.name
                        if db_type == 'postgresql':
                            query = '''INSERT INTO user_mapping (user_id, username) 
                                       VALUES (%s, %s) 
                                       ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username'''
                        else:
                            query = 'INSERT OR REPLACE INTO user_mapping (user_id, username) VALUES (?, ?)'

                        query = prepare_query(query)
                        cursor.execute(query, (user_id, username))
                        conn.commit()
                    except Exception as e:
                        username = f"User {user_id}"

                response += f"**{username}** 🏅 - Predicted Stats: `{winner_stats}`, Outcome: `{winner_outcome}`\n"

            response += "\n🔥 Great job everyone! Let's go for the next round soon! 🔥"
        else:
            response = "No winners found."

        await interaction.response.send_message(response)
