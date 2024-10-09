import discord
from discord.ext import commands
import sqlite3
from enum import Enum
import os
import time

# Define the intents required
intents = discord.Intents.default()
intents.message_content = True  # Ensure you can read message content


# Define the Outcome Enum
class Outcome(Enum):
    WIN = "Win"
    LOSS = "Loss"


# Define the bot
bot = commands.Bot(command_prefix='/', intents=intents)

# Connect to SQLite database (or create it if it doesn't exist)
conn = sqlite3.connect('predictions.db')
cursor = conn.cursor()

# Create table for predictions if it doesn't exist
cursor.execute('''
    CREATE TABLE IF NOT EXISTS predictions (
        user_id INTEGER,
        contest_name TEXT,
        stats TEXT NOT NULL,
        outcome TEXT NOT NULL CHECK (outcome IN ('Win', 'Loss')),
        timestamp INTEGER
    )
''')
conn.commit()

# Create table for contests if it doesn't exist
cursor.execute('''
    CREATE TABLE IF NOT EXISTS contests (
        channel_id INTEGER PRIMARY KEY,
        contest_name TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        creator_id INTEGER NOT NULL
    )
''')
conn.commit()


# Function to insert a prediction
def save_prediction(user_id, contest_name, stats, outcome, timestamp):
    cursor.execute('''
        INSERT INTO predictions (user_id, contest_name, stats, outcome, timestamp)
        VALUES (?, ?, ?, ?, ?)
    ''', (user_id, contest_name, stats, outcome.value, timestamp))  # Use outcome.value for storage
    conn.commit()


# Function to start a contest in a specific channel
def start_contest(channel_id, contest_name, start_time, creator_id):
    cursor.execute('''
        INSERT OR REPLACE INTO contests (channel_id, contest_name, start_time, creator_id)
        VALUES (?, ?, ?, ?)
    ''', (channel_id, contest_name, start_time, creator_id))
    conn.commit()


# Function to get all predictions for the active contest
def get_predictions_for_contest(channel_id):
    cursor.execute('''
        SELECT user_id, stats, outcome, timestamp FROM predictions
        WHERE contest_name = (SELECT contest_name FROM contests WHERE channel_id = ?)
    ''', (channel_id,))
    return cursor.fetchall()


# Function to get user predictions for the current contest in a specific channel
def get_user_predictions_for_contest(user_id, channel_id):
    cursor.execute('''
        SELECT contest_name, stats, outcome, timestamp FROM predictions
        WHERE user_id = ? AND contest_name = (SELECT contest_name FROM contests WHERE channel_id = ?)
    ''', (user_id, channel_id))
    return cursor.fetchall()


# Function to count total predictions
def count_total_predictions():
    cursor.execute('SELECT COUNT(*) FROM predictions')
    return cursor.fetchone()[0]  # Return the count


# Register the slash command for starting a contest
@bot.tree.command(name='start')
async def start(interaction: discord.Interaction, name: str, start_time: int):
    channel = interaction.channel
    user = interaction.user

    # Check if a contest already exists in this channel
    cursor.execute('SELECT contest_name FROM contests WHERE channel_id = ?', (channel.id,))
    existing_contest = cursor.fetchone()

    if existing_contest:
        await interaction.response.send_message(
            f"A contest '{existing_contest[0]}' is already active in this channel. Please finish it before starting a new one.",
            ephemeral=True
        )
        return

    # Start the contest in the specified channel with a start time and the creator's ID
    start_contest(channel.id, name, start_time, user.id)

    # Inform the user that the contest has started
    await interaction.response.send_message(
        f"Contest '{name}' started in this channel! Game starts at <t:{start_time}:F>.", ephemeral=True)


# Register the slash command for prediction
@bot.tree.command(name='predict')
async def predict(interaction: discord.Interaction, stats: str, outcome: str):
    user = interaction.user
    channel = interaction.channel

    # Get the contest name and start time associated with the channel
    cursor.execute('SELECT contest_name, start_time FROM contests WHERE channel_id = ?', (channel.id,))
    contest = cursor.fetchone()

    if contest:
        contest_name, start_time = contest
        current_time = int(time.time())

        # Ensure predictions are made before the game starts
        if current_time >= start_time:
            await interaction.response.send_message("Predictions are closed. The game has already started.",
                                                    ephemeral=True)
            return

        # Validate outcome
        try:
            outcome_enum = Outcome[outcome.upper()]
        except KeyError:
            await interaction.response.send_message("Invalid outcome. Please use 'Win' or 'Loss'.", ephemeral=True)
            return

        # Save the prediction in the database tied to the contest
        save_prediction(user.id, contest_name, stats, outcome_enum, current_time)

        # Inform the user that the prediction has been saved without showing the prediction details
        await interaction.response.send_message(
            f"Prediction saved for {user.name} in contest '{contest_name}'.", ephemeral=True
        )
    else:
        await interaction.response.send_message("No active contest in this channel. Please start a contest first.",
                                                ephemeral=True)


# Register the slash command to remove a prediction
@bot.tree.command(name='remove_prediction')
async def remove_prediction(interaction: discord.Interaction, stats: str, outcome: str):
    user = interaction.user
    channel = interaction.channel

    # Validate outcome
    try:
        outcome_enum = Outcome[outcome.upper()]
    except KeyError:
        await interaction.response.send_message("Invalid outcome. Please use 'Win' or 'Loss'.", ephemeral=True)
        return

    # Check if the prediction exists for the user
    cursor.execute('''
        DELETE FROM predictions
        WHERE user_id = ? AND contest_name = (SELECT contest_name FROM contests WHERE channel_id = ?)
        AND stats = ? AND outcome = ?
    ''', (user.id, channel.id, stats, outcome_enum.value))
    conn.commit()

    # Check if any row was affected
    if cursor.rowcount > 0:
        await interaction.response.send_message("Prediction removed successfully.", ephemeral=True)
    else:
        # If no entry found, list the user's predictions
        predictions = get_user_predictions_for_contest(user.id, channel.id)
        if predictions:
            response = "No such entry. Here are your current predictions:\n"
            for contest_name, stats, outcome, timestamp in predictions:
                response += f"Contest: {contest_name}, Stats: {stats}, Outcome: {outcome}\n"
        else:
            response = "No such entry. You have no predictions in this contest."

        await interaction.response.send_message(response, ephemeral=True)


# Register the slash command to list all predictions
@bot.tree.command(name='predictions')
async def predictions(interaction: discord.Interaction):
    user = interaction.user
    channel = interaction.channel

    # Get the contest start time and creator ID associated with the channel
    cursor.execute('SELECT start_time, creator_id FROM contests WHERE channel_id = ?', (channel.id,))
    contest = cursor.fetchone()

    if contest:
        start_time, creator_id = contest

        # Allow the creator of the contest to access predictions at any time
        if int(time.time()) < start_time and user.id != creator_id:
            await interaction.response.send_message("Predictions are hidden until the game starts.", ephemeral=True)
            return

        # Get all predictions for the active contest (no time filtering)
        predictions = get_predictions_for_contest(channel.id)

        if predictions:
            response = "Predictions for this contest:\n"
            for user_id, stats, outcome, timestamp in predictions:
                user = await bot.fetch_user(user_id)  # Get the user object from user_id
                response += f"{user.name}: Stats: {stats}, Outcome: {outcome}\n"  # Show username without @
        else:
            response = "No predictions have been made for this contest."

        await interaction.response.send_message(response, ephemeral=True)
    else:
        await interaction.response.send_message("No active contest in this channel.", ephemeral=True)


# Register the slash command to show user-specific predictions in the current contest
@bot.tree.command(name='my_predictions')
async def my_predictions(interaction: discord.Interaction):
    user = interaction.user
    channel = interaction.channel

    # Get user predictions for the current contest in the channel
    predictions = get_user_predictions_for_contest(user.id, channel.id)

    if predictions:
        # Create an embed message to show the user's predictions
        embed = discord.Embed(title=f"{user.name}'s Predictions in Current Contest", color=discord.Color.blue())
        for contest_name, stats, outcome, timestamp in predictions:
            embed.add_field(name=contest_name, value=f"Stats: {stats}, Outcome: {outcome}", inline=False)
    else:
        embed = discord.Embed(title="No Predictions",
                              description="You haven't made any predictions for the current contest.",
                              color=discord.Color.red())

    # Send the embed as an ephemeral message (visible only to the user)
    await interaction.response.send_message(embed=embed, ephemeral=True)


# Register the slash command to show the total number of predictions
@bot.tree.command(name='total_predictions')
async def total_predictions(interaction: discord.Interaction):
    total = count_total_predictions()
    await interaction.response.send_message(f"Total predictions made: {total}", ephemeral=True)


# Register slash commands when the bot is ready
@bot.event
async def on_ready():
    await bot.tree.sync()  # Sync commands with Discord
    print(f'Logged in as {bot.user}! Commands synced.')


# Close the database connection when the bot stops
@bot.event
async def on_close():
    conn.close()


# Read the token from secret.txt or environment variable
token = os.getenv('DISCORD_TOKEN')
if not token:
    with open('secret.txt', 'r') as file:
        token = file.read().strip()

# Run the bot
bot.run(token)
