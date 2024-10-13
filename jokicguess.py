import discord
from discord.ext import commands
import sqlite3
from enum import Enum
import os
import time
import discord
import csv
import io
import os
import sqlite3
import psycopg2
from psycopg2 import sql

async def create_predictions_csv(predictions):
    output = io.StringIO()
    writer = csv.writer(output)

    # Write CSV headers
    writer.writerow(['Username', 'Stats', 'Outcome', 'Timestamp'])

    # Write each prediction as a row
    for user_id, stats, outcome, timestamp in predictions:
        # Check the local database for the username
        cursor.execute(prepare_query('SELECT username FROM user_mapping WHERE user_id = ?'), (user_id,))
        result = cursor.fetchone()

        if result:
            username = result[0]
        else:
            try:
                # If username is not in the database, attempt to fetch from Discord
                user_obj = await bot.fetch_user(user_id)
                username = user_obj.name

                # Save the username to the database for future use
                cursor.execute(prepare_query('INSERT OR REPLACE INTO user_mapping (user_id, username) VALUES (?, ?)'),
                               (user_id, username))
                conn.commit()
            except Exception as e:
                # In case fetching from Discord fails, fallback to user_id
                username = f"User {user_id}"

        # Write the row with the username, stats, outcome, and timestamp
        writer.writerow([username, stats, outcome, timestamp])

    # Move back to the beginning of the file-like object
    output.seek(0)

    return output


# Define the intents required
intents = discord.Intents.default()
intents.message_content = True  # Ensure you can read message content


# Define the Outcome Enum
class Outcome(Enum):
    WIN = "Win"
    LOSS = "Loss"


# Define the bot
bot = commands.Bot(command_prefix='/', intents=intents)

# Detect if running on Heroku by checking if DATABASE_URL is set
DATABASE_URL = os.getenv('DATABASE_URL')  # Heroku PostgreSQL URL

if DATABASE_URL:
    # On Heroku, use PostgreSQL
    conn = psycopg2.connect(DATABASE_URL, sslmode='require')
    cursor = conn.cursor()
    db_type = 'postgresql'
else:
    # Locally, use SQLite
    conn = sqlite3.connect('local.db')
    cursor = conn.cursor()
    db_type = 'sqlite'

# Helper function to adjust query placeholders
def prepare_query(query):
    if db_type == 'postgresql':
        # Replace SQLite-style `?` with PostgreSQL-style `%s`
        return query.replace('?', '%s')
    return query  # SQLite uses `?`, so no replacement needed

# Create table for predictions if it doesn't exist
cursor.execute(prepare_query('''
    CREATE TABLE IF NOT EXISTS predictions (
        user_id INTEGER,
        contest_name TEXT,
        stats TEXT NOT NULL,
        outcome TEXT NOT NULL CHECK (outcome IN ('Win', 'Loss')),
        timestamp INTEGER
    )
'''))
conn.commit()

# Create table for contests if it doesn't exist
cursor.execute(prepare_query('''
    CREATE TABLE IF NOT EXISTS contests (
        channel_id INTEGER PRIMARY KEY,
        contest_name TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        creator_id INTEGER NOT NULL
    )
'''))
conn.commit()

cursor.execute(prepare_query('''
    CREATE TABLE IF NOT EXISTS user_mapping (
        user_id BIGINT PRIMARY KEY,
        username TEXT NOT NULL
    );
'''))
conn.commit()

# Function to insert a prediction
def save_prediction(user_id, contest_name, stats, outcome, timestamp):
    cursor.execute(prepare_query('''
        INSERT INTO predictions (user_id, contest_name, stats, outcome, timestamp)
        VALUES (?, ?, ?, ?, ?)
    '''), (user_id, contest_name, stats, outcome.value, timestamp))  # Use outcome.value for storage
    conn.commit()


# Function to start a contest in a specific channel
def start_contest(channel_id, contest_name, start_time, creator_id):
    if db_type == 'postgresql':
        # For PostgreSQL, we use ON CONFLICT to handle upserts
        cursor.execute(prepare_query('''
            INSERT INTO contests (channel_id, contest_name, start_time, creator_id)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (channel_id)
            DO UPDATE SET contest_name = EXCLUDED.contest_name, start_time = EXCLUDED.start_time, creator_id = EXCLUDED.creator_id
        '''), (channel_id, contest_name, str(start_time), creator_id))
    else:
        # For SQLite, we can continue using INSERT OR REPLACE
        cursor.execute(prepare_query('''
            INSERT OR REPLACE INTO contests (channel_id, contest_name, start_time, creator_id)
            VALUES (?, ?, ?, ?)
        '''), (channel_id, contest_name, start_time, creator_id))

    conn.commit()

# Function to get all predictions for the active contest
def get_predictions_for_contest(channel_id):
    cursor.execute(prepare_query('''
        SELECT user_id, stats, outcome, timestamp FROM predictions
        WHERE contest_name = (SELECT contest_name FROM contests WHERE channel_id = ?)
    '''), (channel_id,))
    return cursor.fetchall()


# Function to get user predictions for the current contest in a specific channel
def get_user_predictions_for_contest(user_id, channel_id):
    cursor.execute(prepare_query('''
        SELECT contest_name, stats, outcome, timestamp FROM predictions
        WHERE user_id = ? AND contest_name = (SELECT contest_name FROM contests WHERE channel_id = ?)
    '''), (user_id, channel_id))
    return cursor.fetchall()


# Function to count total predictions
def count_total_predictions():
    cursor.execute(prepare_query('SELECT COUNT(*) FROM predictions'))
    return cursor.fetchone()[0]  # Return the count


# Register the slash command for starting a contest
@bot.tree.command(name='start')
async def start(interaction: discord.Interaction, name: str, start_time: int):
    channel = interaction.channel
    user = interaction.user

    # Check if a contest already exists in this channel
    cursor.execute(prepare_query('SELECT contest_name FROM contests WHERE channel_id = ?'), (channel.id,))
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
    cursor.execute(prepare_query('SELECT contest_name, start_time FROM contests WHERE channel_id = ?'), (channel.id,))
    contest = cursor.fetchone()

    if contest:
        contest_name, start_time = contest
        current_time = int(time.time())

        # Ensure predictions are made before the game starts
        if current_time >= int(start_time):
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
    cursor.execute(prepare_query('''
        DELETE FROM predictions
        WHERE user_id = ? AND contest_name = (SELECT contest_name FROM contests WHERE channel_id = ?)
        AND stats = ? AND outcome = ?
    '''), (user.id, channel.id, stats, outcome_enum.value))
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


@bot.tree.command(name='predictions')
async def predictions(interaction: discord.Interaction):
    user = interaction.user
    channel = interaction.channel

    # Get the contest start time and creator ID associated with the channel
    query = 'SELECT start_time, creator_id FROM contests WHERE channel_id = ?'
    query = prepare_query(query)
    cursor.execute(query, (channel.id,))
    contest = cursor.fetchone()

    if contest:
        start_time, creator_id = contest

        # Allow the creator of the contest to access predictions at any time
        if int(time.time()) < int(start_time) and user.id != creator_id:
            await interaction.response.send_message("Predictions are hidden until the game starts.", ephemeral=True)
            return

        # Get all predictions for the active contest (no time filtering)
        predictions = get_predictions_for_contest(channel.id)

        if predictions:
            response = ""
            for user_id, stats, outcome, timestamp in predictions:
                # Try to fetch the username from the database
                query = 'SELECT username FROM user_mapping WHERE user_id = ?'
                query = prepare_query(query)
                cursor.execute(query, (user_id,))
                result = cursor.fetchone()

                if result:
                    username = result[0]  # Fetch from database
                else:
                    # If the user is not in the local database, fetch from Discord
                    try:
                        user_obj = await bot.fetch_user(user_id)
                        username = user_obj.name
                        # Save to database for future use
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
                        # In case fetching from Discord fails, use user_id as fallback
                        username = f"User {user_id}"

                response += f"{username}: Stats: {stats}, Outcome: {outcome}\n"  # Use the fetched or fallback username

            if len(response) > 2000:
                # Generate CSV file if the response is too large
                csv_output = await create_predictions_csv(predictions)
                csv_filename = f"predictions_{channel.id}.csv"

                # Create Discord file from CSV
                discord_file = discord.File(fp=csv_output, filename=csv_filename)

                # Send CSV file to user
                await interaction.response.send_message(
                    content="The predictions list is too large. Here is the CSV file.", file=discord_file,
                    ephemeral=True)
            else:
                # Send normal response
                await interaction.response.send_message(response, ephemeral=True)
        else:
            await interaction.response.send_message("No predictions have been made for this contest.", ephemeral=True)
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


@bot.tree.command(name='winner')
async def winner(interaction: discord.Interaction, stats: int, outcome: str):
    channel = interaction.channel
    user = interaction.user

    # Validate outcome input
    if outcome not in ['Win', 'Loss']:
        await interaction.response.send_message("Invalid outcome. Outcome must be 'Win' or 'Loss'.", ephemeral=True)
        return

    # Fetch contest details (start_time, creator_id) associated with the channel
    query = 'SELECT start_time, creator_id FROM contests WHERE channel_id = ?'
    query = prepare_query(query)
    cursor.execute(query, (channel.id,))
    contest = cursor.fetchone()

    if not contest:
        await interaction.response.send_message("No active contest found for this channel.", ephemeral=True)
        return

    start_time, creator_id = contest

    # Check if the user invoking the command is the contest creator
    if user.id != creator_id:
        await interaction.response.send_message("Only the contest creator can declare the winner.", ephemeral=True)
        return

    # Fetch all predictions for the current contest in the channel
    predictions = get_predictions_for_contest(channel.id)

    if not predictions:
        await interaction.response.send_message("No predictions found for this contest.", ephemeral=True)
        return

    # Filter predictions with the correct outcome
    valid_predictions = [p for p in predictions if p[2] == outcome]  # p[2] is the outcome

    if not valid_predictions:
        await interaction.response.send_message("No predictions with the correct outcome.", ephemeral=True)
        return

    # Find the prediction(s) with the smallest difference in stats
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

            # Fetch the username from the database or Discord
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
                    # Save username to the database
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

    # Send the response with the list of winners
    await interaction.response.send_message(response)

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