import discord
from discord.ext import commands
import sqlite3
from enum import Enum
import os

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

# Create table for predictions if it doesn't exist (allow multiple predictions by same user)
cursor.execute('''
    CREATE TABLE IF NOT EXISTS predictions (
        user_id INTEGER,
        contest_name TEXT,
        stats TEXT NOT NULL,
        outcome TEXT NOT NULL CHECK (outcome IN ('Win', 'Loss'))
    )
''')
conn.commit()

# Create table for contests if it doesn't exist
cursor.execute('''
    CREATE TABLE IF NOT EXISTS contests (
        channel_id INTEGER PRIMARY KEY,
        contest_name TEXT NOT NULL
    )
''')
conn.commit()


# Function to insert a prediction
def save_prediction(user_id, contest_name, stats, outcome):
    cursor.execute('''
        INSERT INTO predictions (user_id, contest_name, stats, outcome)
        VALUES (?, ?, ?, ?)
    ''', (user_id, contest_name, stats, outcome.value))  # Use outcome.value for storage
    conn.commit()


# Function to start a contest in a specific channel
def start_contest(channel_id, contest_name):
    cursor.execute('''
        INSERT OR REPLACE INTO contests (channel_id, contest_name)
        VALUES (?, ?)
    ''', (channel_id, contest_name))
    conn.commit()


# Function to get predictions for the active contest
def get_predictions_for_contest(channel_id):
    cursor.execute('''
        SELECT user_id, stats, outcome FROM predictions
        WHERE contest_name = (SELECT contest_name FROM contests WHERE channel_id = ?)
    ''', (channel_id,))
    return cursor.fetchall()


# Function to get predictions for a specific user
def get_predictions_for_user(user_id):
    cursor.execute('''
        SELECT contest_name, stats, outcome FROM predictions
        WHERE user_id = ?
    ''', (user_id,))
    return cursor.fetchall()


# Register the slash command for starting a contest
@bot.tree.command(name='start')
async def start(interaction: discord.Interaction, name: str):
    channel = interaction.channel
    contest_name = name

    # Check if a contest already exists in this channel
    cursor.execute('SELECT contest_name FROM contests WHERE channel_id = ?', (channel.id,))
    existing_contest = cursor.fetchone()

    if existing_contest:
        await interaction.response.send_message(
            f"A contest '{existing_contest[0]}' is already active in this channel. Please finish it before starting a new one."
        )
        return

    # Start the contest in the specified channel
    start_contest(channel.id, contest_name)

    # Inform the user that the contest has started
    await interaction.response.send_message(f"Contest '{contest_name}' started in this channel!")


# Register the slash command for prediction
@bot.tree.command(name='predict')
async def predict(interaction: discord.Interaction, stats: str, outcome: str):
    user = interaction.user
    channel = interaction.channel

    # Validate outcome
    try:
        outcome_enum = Outcome[outcome.upper()]
    except KeyError:
        await interaction.response.send_message("Invalid outcome. Please use 'Win' or 'Loss'.")
        return

    # Get the contest name associated with the channel
    cursor.execute('SELECT contest_name FROM contests WHERE channel_id = ?', (channel.id,))
    contest = cursor.fetchone()

    if contest:
        contest_name = contest[0]
        # Save the prediction in the database tied to the contest
        save_prediction(user.id, contest_name, stats, outcome_enum)

        # Inform the user that the prediction has been saved without showing the prediction details
        await interaction.response.send_message(
            f"Prediction saved for {user.name} in contest '{contest_name}'."
        )
    else:
        await interaction.response.send_message("No active contest in this channel. Please start a contest first.")


# Register the slash command to list all predictions
@bot.tree.command(name='predictions')
async def predictions(interaction: discord.Interaction):
    channel = interaction.channel

    # Get predictions for the active contest
    predictions = get_predictions_for_contest(channel.id)

    if predictions:
        # Format the predictions to send without tagging users
        response = "Predictions for this contest:\n"
        for user_id, stats, outcome in predictions:
            user = await bot.fetch_user(user_id)  # Get the user object from user_id
            response += f"{user.name}: Stats: {stats}, Outcome: {outcome}\n"  # Show username without @
    else:
        response = "No predictions have been made for this contest."

    await interaction.response.send_message(response)


# Register the slash command to show user-specific predictions in an ephemeral message
@bot.tree.command(name='my_predictions')
async def my_predictions(interaction: discord.Interaction):
    user = interaction.user

    # Get predictions for the user
    predictions = get_predictions_for_user(user.id)

    if predictions:
        # Create an embed message to show the user's predictions
        embed = discord.Embed(title=f"{user.name}'s Predictions", color=discord.Color.blue())
        for contest_name, stats, outcome in predictions:
            embed.add_field(name=contest_name, value=f"Stats: {stats}, Outcome: {outcome}", inline=False)
    else:
        embed = discord.Embed(title="No Predictions", description="You haven't made any predictions yet.",
                              color=discord.Color.red())

    # Send the embed as an ephemeral message (visible only to the user)
    await interaction.response.send_message(embed=embed, ephemeral=True)


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
