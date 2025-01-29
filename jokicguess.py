import discord
from discord.ext import commands
import time
import discord
from utils.helpers import *
from discord import app_commands
from typing import Literal
import datetime
import random
from datetime import date

PETTING_ALLOWED_CHANNEL_ID = 1333948717824475187  # Petting allowed channel ID or thread ID
DEFAULT_FREE_DAILY_PETS = 1 # Daily free pets for each user
SPECIAL_REWARD_NAME = "Grail seeker pack" # Special rewards
SPECIAL_REWARD_ODDS = 1 / 200

# Define the intents required
intents = discord.Intents.default()
intents.message_content = True  # Ensure you can read message content

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

# Create table for predictions if it doesn't exist
cursor.execute(prepare_query('''
    CREATE TABLE IF NOT EXISTS predictions (
        user_id BIGINT,  -- Use BIGINT for user_id
        contest_name TEXT,
        stats TEXT NOT NULL,
        outcome TEXT NOT NULL CHECK (outcome IN ('Win', 'Loss')),
        timestamp BIGINT NOT NULL  -- Use BIGINT for timestamp
    )
'''))
conn.commit()

# Create table for contests if it doesn't exist
cursor.execute(prepare_query('''
    CREATE TABLE IF NOT EXISTS contests (
        channel_id BIGINT PRIMARY KEY,  -- Use BIGINT for channel_id
        contest_name TEXT NOT NULL,
        start_time BIGINT NOT NULL,  -- Use BIGINT for start_time
        creator_id BIGINT NOT NULL  -- Use BIGINT for creator_id
    )
'''))
conn.commit()

# Create table for user mapping if it doesn't exist
cursor.execute(prepare_query('''
    CREATE TABLE IF NOT EXISTS user_mapping (
        user_id BIGINT PRIMARY KEY,
        username TEXT NOT NULL
    );
'''))
conn.commit()

# Create table for user rewards
cursor.execute(prepare_query('''
    CREATE TABLE IF NOT EXISTS user_rewards (
        user_id BIGINT PRIMARY KEY,  -- Unique identifier for each user
        balance REAL NOT NULL DEFAULT 0,  -- $MVP balance for unclaimed rewards
        daily_pets_remaining INTEGER NOT NULL DEFAULT 1,  -- Number of pets left for the day
        last_pet_date TEXT  -- Last date the user performed a pet action (as YYYY-MM-DD string)
    )
'''))
conn.commit()

# Register the slash command for starting a contest
@bot.tree.command(name='start', description='Start a contest (Admin only)')
@commands.has_permissions(administrator=True)
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
@bot.tree.command(name='predict', description='Predict stats total and game outcome')
@app_commands.describe(
    stats='Total of 2xPts+3xReb+5xAs+7xStl+9xBlk for the player',
    outcome="Player's team wins or loses the game?",
)
async def predict(interaction: discord.Interaction, stats: str, outcome: Literal['Win', 'Loss']):
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
@bot.tree.command(name='remove_prediction', description='Remove a prediction')
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


@bot.tree.command(name='predictions', description="List all predictions")
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
@bot.tree.command(name='my_predictions', description='List my predictions')
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
@bot.tree.command(name='total_predictions', description='Show number of predictions')
async def total_predictions(interaction: discord.Interaction):
    channel = interaction.channel
    total = count_total_predictions(channel.id)
    await interaction.response.send_message(f"Total predictions made: {total}", ephemeral=True)


@bot.tree.command(name='winner', description='Declare winner (Admin only)')
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

#Register slash commands when the bot is ready
@bot.event
async def on_ready():
    await bot.tree.sync()  # Sync commands with Discord
    print(f'Logged in as {bot.user}! Commands synced.')


# Pet command for $MVP rewards
@bot.tree.command(name="pet", description="Perform a daily pet and earn random $MVP rewards!")
async def pet(interaction: discord.Interaction):
    if interaction.channel_id != PETTING_ALLOWED_CHANNEL_ID:
        return await interaction.response.send_message(
            "You can only pet your horse in the petting zoo.", ephemeral=True
        )

    user_id = interaction.user.id  # Get the user's ID
    today = datetime.datetime.utcnow().strftime("%Y-%m-%d")  # Current date (UTC)

    def custom_reward():
        #Generate reward value
        random_choice = random.random()  # Random number to determine which range to sample from

        if random_choice < 0.5:
            reward = random.uniform(0.01, 0.1)
        elif random_choice < 0.9:
            reward = random.uniform(0.1, 0.5)
        else:
            reward = random.uniform(0.5, 1)
        return round(reward, 2)

    # Fetch user data from the database
    cursor.execute(prepare_query(
        "SELECT balance, daily_pets_remaining, last_pet_date FROM user_rewards WHERE user_id = ?"
    ), (user_id,))
    user_data = cursor.fetchone()

    if not user_data:
        # Initialize user in the database if not found
        cursor.execute(prepare_query(
            "INSERT INTO user_rewards (user_id, balance, daily_pets_remaining, last_pet_date) VALUES (?, ?, ?, ?)"
        ), (user_id, 0, 1, None))
        conn.commit()
        user_data = (0, 1, None)

    balance, daily_pets_remaining, last_pet_date = user_data

    # Check if the user has already used their pets for the day
    if last_pet_date != today:
        # Reset pets if it's a new day
        daily_pets_remaining = DEFAULT_FREE_DAILY_PETS

    if daily_pets_remaining <= 0:
        await interaction.response.send_message(
            "You've used all your pets for today! Try again tomorrow.", ephemeral=True
        )
        return

    # Generate the random reward
    reward = custom_reward()

    # Special reward logic
    special_reward_name = SPECIAL_REWARD_NAME
    special_reward_odds = SPECIAL_REWARD_ODDS
    is_special_reward = random.random() < special_reward_odds
    special_reward_message = ""

    if is_special_reward:
        special_reward_message = f"🎉 Congratulations <@{interaction.user.id}>! You won a special reward **{special_reward_name}**! 🎉"
        # Respond to the user
        await interaction.response.send_message(
            f"{special_reward_message}\n"
            f"<@1261935277753241653> will follow up with the reward shortly"
            ,
            ephemeral=False # If special reward is won, everyone will see
        )

    else:
        # Update user data
        new_balance = balance + reward
        new_daily_pets_remaining = daily_pets_remaining - 1

        cursor.execute(prepare_query(
            "UPDATE user_rewards SET balance = ?, daily_pets_remaining = ?, last_pet_date = ? WHERE user_id = ?"
        ), (new_balance, new_daily_pets_remaining, today, user_id))
        conn.commit()

        await interaction.response.send_message(
            f"You earned **{reward} $MVP** from petting your horse! 🐴\n"
            f"Your new balance is **{new_balance} $MVP**.\n"
            f"{special_reward_message}",
            ephemeral=True  # If special reward is won, everyone will see
        )

@bot.tree.command(name="my_rewards", description="View your unclaimed $MVP rewards.")
async def my_rewards(interaction: discord.Interaction):
    if interaction.channel_id != PETTING_ALLOWED_CHANNEL_ID:
        return await interaction.response.send_message(
            "You can check your rewards in the petting zoo.", ephemeral=True
        )

    user_id = interaction.user.id

    cursor.execute(prepare_query("SELECT balance FROM user_rewards WHERE user_id = ?"), (user_id,))
    user_data = cursor.fetchone()

    if not user_data or user_data[0] == 0:
        await interaction.response.send_message(
            "You have no unclaimed rewards. Start petting to earn rewards!", ephemeral=True
        )
    else:
        await interaction.response.send_message(
            f"Your unclaimed rewards: **{user_data[0]:.2f} $MVP**", ephemeral=True
        )

@bot.tree.command(name="claim", description="Claim your accumulated $MVP rewards.")
async def claim(interaction: discord.Interaction):
    if interaction.channel_id != PETTING_ALLOWED_CHANNEL_ID:
        return await interaction.response.send_message(
            "You can claim your rewards in the petting zoo in the petting zoo.", ephemeral=True
        )

    user_id = interaction.user.id

    cursor.execute(prepare_query("SELECT balance FROM user_rewards WHERE user_id = ?"), (user_id,))
    user_data = cursor.fetchone()

    if not user_data or user_data[0] < 1:
        await interaction.response.send_message(
            "You need at least 1 $MVP to claim.", ephemeral=True
        )
        return

    balance = user_data[0]
    cursor.execute(prepare_query("UPDATE user_rewards SET balance = 0 WHERE user_id = ?"), (user_id,))
    conn.commit()

    await interaction.response.send_message(
        f"{interaction.user.mention} has claimed **{balance:.2f} $MVP**! 🐴\n<@1261935277753241653>, please process the claim."
    )

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