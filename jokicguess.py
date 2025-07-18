import statistics

import discord
from discord.ext import commands
import time
import discord
from utils.helpers import *
from discord import app_commands
from typing import Literal
import datetime
import random
from flask import Flask, render_template, g, jsonify
import threading
from datetime import date
import swapfest
import math
from flask_cors import CORS
from flask import send_from_directory, request

# Run mock on port 8000 for Azure
app = Flask(__name__)
CORS(app)

def get_db():
    if 'db' not in g:
        if db_type == 'postgresql':
            g.db = psycopg2.connect(DATABASE_URL, sslmode='require')
        else:
            g.db = sqlite3.connect('local.db', detect_types=sqlite3.PARSE_DECLTYPES)
            g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_db(error):
    db = g.pop('db', None)
    if db is not None:
        db.close()

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    if path != "" and os.path.exists(f"react-build/{path}"):
        return send_from_directory('react-build', path)
    else:
        return send_from_directory('react-build', 'index.html')

@app.route("/api/leaderboard")
def api_leaderboard():
    # Define event period in UTC
    start_time = '2025-07-01 21:00:00'
    end_time = '2025-07-12 01:00:00'

    db = get_db()
    cursor = db.cursor()

    cursor.execute(prepare_query('''
        SELECT from_address, SUM(points) AS total_points
        FROM gifts
        WHERE timestamp BETWEEN ? AND ?
        GROUP BY from_address
        ORDER BY total_points DESC
    '''), (start_time, end_time))

    rows = cursor.fetchall()

    # Map wallets to usernames
    leaderboard_data = [
        {
            "username": map_wallet_to_username(from_address),
            "points": total_points
        }
        for from_address, total_points in rows
    ]

    # 1️⃣ Calculate total prize pool
    prize_pool = sum(entry["points"] for entry in leaderboard_data)

    # 2️⃣ Prize percentage mapping by rank
    prize_percentages = {
        1: 25,
        2: 20,
        3: 15,
        4: 11,
        5: 8,
        6: 6,
        7: 5,
        8: 4,
        9: 3,
        10: 2
    }

    # 3️⃣ Add prize info to each leaderboard entry
    for index, entry in enumerate(leaderboard_data, start=1):
        if index in prize_percentages:
            percent = prize_percentages[index]
            pet_count = math.ceil(float(prize_pool) * (percent / 100))
            entry["prize"] = f"{ordinal(index)} pick + Pet your horse {pet_count} times"
        else:
            entry["prize"] = "-"

    # ✅ Return JSON
    return jsonify({
        "prize_pool": prize_pool,
        "leaderboard": leaderboard_data
    })

@app.route('/api/treasury')
def api_treasury():
    # Hard-coded example data
    treasury_data = {
        "tokens_in_wild": 15337,
        "common_count": 2156,
        "rare_count": 130,
        "tsd_count": 0,
        "lego_count": 3,
    }

    # Calculating backed supply
    backed_supply = (
        treasury_data["common_count"] * 2
        + treasury_data["rare_count"] * 100
        + treasury_data["tsd_count"] * 500
        + treasury_data["lego_count"] * 2000
    )

    surplus = backed_supply - treasury_data["tokens_in_wild"]

    treasury_data["backed_supply"] = backed_supply
    treasury_data["surplus"] = surplus

    # 🗓️ Manually updated last_updated text
    treasury_data['last_updated'] = "2025-07-15 15:00 UTC"
    return jsonify(treasury_data)

@app.route("/api/fastbreak/contests", methods=["GET"])
def api_list_fastbreak_contests():
    cursor.execute(prepare_query('''
        SELECT id, fastbreak_id, lock_timestamp, buy_in_currency, buy_in_amount, status, created_at, display_name
        FROM fastbreakContests
        ORDER BY lock_timestamp ASC
    '''))
    rows = cursor.fetchall()

    contests = []
    now_ts = int(datetime.datetime.now(datetime.UTC).timestamp())
    for row in rows:
        contest_status = row[5]
        try:
            if contest_status == 'OPEN' and int(row[2]) < now_ts:
                contest_status = 'STARTED'
        except:
            pass

        if contest_status != 'CLOSED':
            contests.append({
                "id": row[0],
                "fastbreak_id": row[1],
                "lock_timestamp": row[2],
                "buy_in_currency": row[3],
                "buy_in_amount": float(row[4]),
                "status": contest_status,
                "created_at": row[6],
                "display_name": row[7]
            })

    return jsonify(contests)

@app.route("/api/fastbreak/contest/<int:contest_id>/prediction-leaderboard", methods=["GET"])
def get_fastbreak_prediction_leaderboard(contest_id):
    user_wallet = request.args.get('userWallet', '').lower()

    # Get contest info, including fastbreak_id
    cursor.execute(prepare_query('''
        SELECT lock_timestamp, buy_in_amount, status, fastbreak_id
        FROM fastbreakContests
        WHERE id = ?
    '''), (contest_id,))
    row = cursor.fetchone()
    if not row:
        return jsonify({"error": "Contest not found"}), 404

    lock_timestamp, buy_in_amount, status, fastbreak_id = row
    now_ts = int(datetime.datetime.now(datetime.UTC).timestamp())
    is_started = (status == 'CLOSED') or (status == 'OPEN' and int(lock_timestamp) < now_ts)

    # Load all entries
    cursor.execute(prepare_query('''
        SELECT userWalletAddress, topshotUsernamePrediction
        FROM fastbreakContestEntries
        WHERE contest_id = ?
    '''), (contest_id,))
    entries = cursor.fetchall()

    total_entries = len(entries)
    total_pot = total_entries * float(buy_in_amount) * 0.95

    if is_started:
        # Contest STARTED: build leaderboard
        result_entries = []
        for e in entries:
            wallet = e[0].lower()
            prediction = e[1]

            # Call your helper with fastbreak_id
            fastbreak_data = get_rank_and_lineup_for_user(prediction, fastbreak_id)
            # Expected: { "rank": int, "lineup": [player1, player2, ...] }

            result_entries.append({
                "wallet": wallet,
                "prediction": prediction,
                "rank": fastbreak_data.get("rank"),
                "points": fastbreak_data.get("points"),
                "lineup": fastbreak_data.get("players"),
                "isUser": (wallet == user_wallet)
            })

        # Sort by fastbreak rank (lowest = better)
        result_entries.sort(key=lambda x: x["rank"] if x["rank"] is not None else 9999)

        # Add position number
        for idx, item in enumerate(result_entries):
            item["position"] = idx + 1

        return jsonify({
            "status": "STARTED",
            "entries": result_entries,
            "totalEntries": total_entries,
            "totalPot": total_pot,
        })

    else:
        # Contest NOT started
        user_entries = []
        for e in entries:
            wallet = e[0].lower()
            prediction = e[1]
            if wallet == user_wallet:
                stats = get_rank_and_lineup_for_user(prediction, fastbreak_id)
                user_entries.append({
                    "wallet": wallet,
                    "prediction": prediction,
                    "rank": stats.get("rank"),
                    "points": stats.get("points"),
                    "lineup": stats.get("players")
                })


        return jsonify({
            "status": "NOT_STARTED",
            "totalEntries": total_entries,
            "totalPot": total_pot,
            "userEntries": user_entries
        })

@app.route("/api/fastbreak/contest/<int:contest_id>/entries", methods=["GET"])
def api_list_fastbreak_entries(contest_id):
    # Fetch contest to check lock time and status
    cursor.execute(prepare_query('''
        SELECT lock_timestamp, status
        FROM fastbreakContests
        WHERE id = ?
    '''), (contest_id,))
    row = cursor.fetchone()

    if not row:
        return jsonify({"error": "Contest not found"}), 404

    lock_timestamp, status = row
    now_ts = int(datetime.datetime.now(datetime.UTC).timestamp())

    # Determine if contest is "STARTED" or "CLOSED"
    is_started = False
    try:
        if status == 'CLOSED':
            is_started = True
        elif status == 'OPEN' and int(lock_timestamp) < now_ts:
            is_started = True
    except:
        pass

    if not is_started:
        return jsonify({"error": "Entries are not available before the contest locks."}), 403

    # Entries are allowed
    cursor.execute(prepare_query('''
        SELECT id, contest_id, topshotUsernamePrediction, userWalletAddress, created_at
        FROM fastbreakContestEntries
        WHERE contest_id = ?
        ORDER BY created_at ASC
    '''), (contest_id,))
    rows = cursor.fetchall()

    entries = []
    for row in rows:
        entries.append({
            "id": row[0],
            "contest_id": row[1],
            "topshotUsernamePrediction": row[2],
            "userWalletAddress": row[3],
            "created_at": row[4]
        })

    return jsonify(entries)


@app.route("/api/fastbreak/contest/<int:contest_id>/entries/user/<wallet_address>", methods=["GET"])
def api_list_user_fastbreak_entries(contest_id, wallet_address):
    cursor.execute(prepare_query('''
        SELECT id, contest_id, topshotUsernamePrediction, userWalletAddress, created_at
        FROM fastbreakContestEntries
        WHERE contest_id = ? AND userWalletAddress = ?
        ORDER BY created_at ASC
    '''), (contest_id, wallet_address))
    rows = cursor.fetchall()

    entries = []
    for row in rows:
        entries.append({
            "id": row[0],
            "contest_id": row[1],
            "topshotUsernamePrediction": row[2],
            "userWalletAddress": row[3],
            "created_at": row[4]
        })

    return jsonify(entries)

@app.route("/api/fastbreak/contest/<int:contest_id>/entries", methods=["POST"])
def add_fastbreak_entry(contest_id):
    data = request.get_json()
    user_wallet = data.get("userWalletAddress")
    prediction = data.get("topshotUsernamePrediction")

    if not user_wallet or not prediction:
        return jsonify({"error": "Missing data"}), 400

    # Check contest status and lock time
    cursor.execute(prepare_query('''
        SELECT lock_timestamp, status
        FROM fastbreakContests
        WHERE id = ?
        ORDER BY lock_timestamp ASC
    '''), (contest_id,))
    row = cursor.fetchone()

    if not row:
        return jsonify({"error": "Contest not found"}), 404

    lock_timestamp, status = row
    now_ts = int(datetime.datetime.now(datetime.UTC).timestamp())

    # Enforce rules
    if status != "OPEN":
        return jsonify({"error": "This contest is no longer accepting entries."}), 403

    if int(lock_timestamp) <= now_ts:
        return jsonify({"error": "This contest is already locked for new entries."}), 403

    # Insert entry
    cursor.execute(prepare_query('''
        INSERT INTO fastbreakContestEntries (contest_id, userWalletAddress, topshotUsernamePrediction)
        VALUES (?, ?, ?)
    '''), (contest_id, user_wallet.lower(), prediction))
    conn.commit()

    return jsonify({"success": True})


@app.route("/api/fastbreak_racing_stats/<username>")
def fastbreak_racing_stats_user(username):
    db = get_db()
    cursor = db.cursor()

    cursor.execute(prepare_query('''
        SELECT fb.game_date, fr.rank
        FROM fastbreak_rankings fr
        JOIN fastbreaks fb ON fr.fastbreak_id = fb.id
        WHERE LOWER(fr.username) = LOWER(?)
        ORDER BY fb.game_date DESC
        LIMIT 25
    '''), (username,))

    rows = cursor.fetchall()

    rankings = [
        {
            "gameDate": game_date,
            "rank": rank
        }
        for game_date, rank in rows
    ]

    rank_values = [r["rank"] for r in rankings]

    # Compute summary stats
    best = min(rank_values) if rank_values else None
    mean = round(statistics.mean(rank_values), 2) if rank_values else None
    median = statistics.median(rank_values) if rank_values else None

    return jsonify({
        "username": username,
        "rankings": rankings,
        "best": best,
        "mean": mean,
        "median": median
    })

@app.route("/api/fastbreak_racing_stats")
def fastbreak_racing_stats_general():
    from flask import request

    db = get_db()
    cursor = db.cursor()

    # Pagination params
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 25))
    offset = (page - 1) * per_page

    # Step 1: Pull from materialized view
    cursor.execute(prepare_query('''
        SELECT username, best, mean
        FROM user_rankings_summary
        ORDER BY mean ASC
        LIMIT ? OFFSET ?
    '''), (per_page, offset))
    rows = cursor.fetchall()

    leaderboard = [
        {
            "username": username,
            "best": best,
            "mean": float(mean)
        }
        for username, best, mean in rows
    ]

    # Step 2: Total users for pagination
    cursor.execute('SELECT COUNT(*) FROM user_rankings_summary')
    total_users = cursor.fetchone()[0]

    return jsonify({
        "page": page,
        "per_page": per_page,
        "total_users": total_users,
        "leaderboard": leaderboard
    })


def run_flask():
    app.run(host="0.0.0.0", port=8000)
threading.Thread(target=run_flask).start()

PETTING_ALLOWED_CHANNEL_ID = 1333948717824475187  # Petting allowed channel ID or thread ID
DEFAULT_FREE_DAILY_PETS = 1 # Daily free pets for each user
SPECIAL_REWARD_NAME = "Grail seeker pack" # Special rewards
SPECIAL_REWARD_ODDS = 1 / 200
# Detect if running on Heroku by checking if DATABASE_URL is set
DATABASE_URL = os.getenv('DATABASE_URL')  # Heroku PostgreSQL URL

# Define the intents required
intents = discord.Intents.default()
intents.members = True
intents.message_content = True  # Ensure you can read message content

# Define the bot
bot = commands.Bot(command_prefix='/', intents=intents)

if DATABASE_URL:
    # On Heroku/Azure, use PostgreSQL
    conn = psycopg2.connect(DATABASE_URL, sslmode='require')
    cursor = conn.cursor()
    db_type = 'postgresql'
else:
    # Locally, use SQLite
    conn = sqlite3.connect('local.db', check_same_thread=False)
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

# Create gifts table
cursor.execute(prepare_query('''
    CREATE TABLE IF NOT EXISTS gifts (
        id SERIAL PRIMARY KEY,
        txn_id TEXT UNIQUE,
        moment_id BIGINT,
        from_address TEXT,
        points BIGINT,
        timestamp TEXT
    )
'''))
conn.commit()

# Create scraper_state table to track last processed block
cursor.execute(prepare_query('''
    CREATE TABLE IF NOT EXISTS scraper_state (
        key TEXT PRIMARY KEY,
        value TEXT
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

cursor.execute(prepare_query('''
    CREATE TABLE IF NOT EXISTS special_rewards (
        id SERIAL PRIMARY KEY,  
        name TEXT NOT NULL,       -- Name of the special reward
        probability REAL NOT NULL, -- Probability (e.g., 0.002 for 0.2%)
        amount INTEGER   -- Amount remaining before it runs out
    )
'''))
conn.commit()

# These are our contests
cursor.execute(prepare_query('''
    CREATE TABLE IF NOT EXISTS fastbreakContests (
        id SERIAL PRIMARY KEY,
        fastbreak_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        lock_timestamp TEXT NOT NULL,
        buy_in_currency TEXT DEFAULT '$MVP',
        buy_in_amount NUMERIC DEFAULT 5,
        status TEXT DEFAULT 'OPEN', 
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
'''))
conn.commit()

# These are entries to our contests, not on TS
cursor.execute(prepare_query('''
    CREATE TABLE IF NOT EXISTS fastbreakContestEntries (
        id SERIAL PRIMARY KEY,                    -- Unique entry ID
        contest_id INTEGER REFERENCES fastbreakContests(id), -- Linked contest
        topshotUsernamePrediction TEXT NOT NULL,  -- User's predicted TopShot username
        userWalletAddress TEXT NOT NULL,          -- User's Flow wallet address
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- When entry was made
    )
'''))
conn.commit()


cursor.execute(prepare_query('''
    CREATE TABLE IF NOT EXISTS fastbreaks (
        id TEXT PRIMARY KEY,
        game_date TEXT,
        run_name TEXT,
        status TEXT
    )
'''))
conn.commit()

cursor.execute(prepare_query('''
    CREATE TABLE IF NOT EXISTS fastbreak_rankings (
        id SERIAL PRIMARY KEY,
        fastbreak_id TEXT,
        username TEXT,
        rank INTEGER,
        points INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
'''))
conn.commit()

if db_type == "postgresql":
    cursor.execute(prepare_query('''
        CREATE MATERIALIZED VIEW IF NOT EXISTS user_rankings_summary AS
        SELECT
            username,
            COUNT(*) AS total_entries,
            MIN(rank) AS best,
            ROUND(AVG(rank), 2) AS mean
        FROM fastbreak_rankings
        GROUP BY username
    '''))
    cursor.execute(prepare_query('''
        ALTER TABLE fastbreak_rankings
        ADD CONSTRAINT unique_fb_user UNIQUE (fastbreak_id, username);
    '''))
else:
    # Create view for per-user ranking summaries
    cursor.execute(prepare_query('''
        CREATE VIEW IF NOT EXISTS user_rankings_summary AS
        SELECT username,
            COUNT(*)            AS total_entries,
            MIN(rank)           AS best,
            ROUND(AVG(rank), 2) AS mean
        FROM fastbreak_rankings
        GROUP BY username
    '''))

    # Create index to speed up username filtering
    cursor.execute(prepare_query('''
                                 CREATE INDEX IF NOT EXISTS idx_fastbreak_rankings_username
                                     ON fastbreak_rankings(username)
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

@bot.tree.command(name="list_active_fastbreak_runs", description="Admin only: Dump all active FastBreak runs as JSON file")
@app_commands.checks.has_permissions(administrator=True)
async def list_active_fastbreak_runs(interaction: discord.Interaction):
    await interaction.response.defer()

    # Admin check
    if not is_admin(interaction):
        await interaction.response.send_message(
            "You need admin permissions to run this command.",
            ephemeral=True
        )
        return
    try:
        runs = extract_fastbreak_runs()

        # Convert to JSON string
        json_data = json.dumps(runs, indent=2)

        # Put it in a BytesIO buffer
        buffer = io.BytesIO(json_data.encode('utf-8'))
        buffer.seek(0)

        # Create a Discord file
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
    buy_in_currency: str = '$MVP',
    buy_in_amount: float = 5.0
):
    # Admin check
    if not is_admin(interaction):
        await interaction.response.send_message(
            "You need admin permissions to run this command.",
            ephemeral=True
        )
        return

    # Insert into DB
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
    # Check admin
    if not is_admin(interaction):
        await interaction.response.send_message(
            "You need admin permissions to run this command.",
            ephemeral=True
        )
        return

    # Update DB
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


# Register slash commands when the bot is ready
@bot.event
async def on_ready():
    await bot.tree.sync()  # Sync commands with Discord
    print(f'Logged in as {bot.user}! Commands synced.')
    bot.loop.create_task(swapfest.main())


# Pet command for $MVP rewards
@bot.tree.command(name="pet", description="Perform a daily pet and earn random $MVP rewards!")
async def pet(interaction: discord.Interaction):
    if interaction.channel_id != PETTING_ALLOWED_CHANNEL_ID:
        return await interaction.response.send_message(
            "You can only pet your horse in the petting zoo.", ephemeral=True
        )

    user_id = interaction.user.id  # Get the user's ID
    today = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d")  # Current date (UTC)

    # Function to check for special reward
    def check_special_reward():
        cursor.execute(prepare_query("SELECT id, name, probability, amount FROM special_rewards"))
        rewards = cursor.fetchall()

        for reward_id, name, probability, amount in rewards:
            if random.random() <= probability:  # Hit probability
                if amount > 0:

                    # Reduce the amount remaining
                    cursor.execute(prepare_query(
                        f"UPDATE special_rewards SET amount = {amount - 1} WHERE id = ?"
                    ), (reward_id,))
                    conn.commit()
                    # If amount is now zero, remove from tracking
                    if amount - 1 == 0:
                        cursor.execute(prepare_query(
                            "DELETE FROM special_rewards WHERE name = ?"
                        ), (name,))
                        conn.commit()
                    return name  # Return the reward name if won

        return None  # No special reward won

    # Fetch user data from the database
    cursor.execute(prepare_query(
        "SELECT balance, daily_pets_remaining, last_pet_date FROM user_rewards WHERE user_id = ?"
    ), (user_id,))
    user_data = cursor.fetchone()

    if not user_data:
        # Initialize user in the database if not found
        cursor.execute(prepare_query(
            "INSERT INTO user_rewards (user_id, balance, daily_pets_remaining, last_pet_date) VALUES (?, ?, ?, ?)"
        ), (user_id, 0, 0, None))
        conn.commit()
        user_data = (0, 0, None)

    balance, daily_pets_remaining, last_pet_date = user_data

    # Check if the user has already used their pets for the day
    if last_pet_date != today:
        # Reset pets if it's a new day
        daily_pets_remaining += DEFAULT_FREE_DAILY_PETS

    if daily_pets_remaining <= 0:
        await interaction.response.send_message(
            "Hold your horses! You've used all your pets for today! Try again tomorrow.", ephemeral=True
        )
        return

    # Generate the random reward
    reward = custom_reward()

    # Special reward logic
    special_reward = check_special_reward()
    special_reward_message = ""
    new_daily_pets_remaining = daily_pets_remaining - 1
    if special_reward:
        new_balance = balance
        special_reward_message = f"🎉 Congratulations <@{interaction.user.id}>! You won a special reward **{special_reward}**! 🎉"
        # Respond to the user
        await interaction.response.send_message(
            f"{special_reward_message}\n"
            f"<@1261935277753241653> will follow up with the reward shortly\n"
            f"Daily pets remaining: **{new_daily_pets_remaining}**.\n",
            ephemeral=False # If special reward is won, everyone will see
        )

    else:
        # Update user data
        new_balance = balance + reward
        await interaction.response.send_message(
            get_basic_pet_response(reward) +
            f"\nYour new balance is **{new_balance} $MVP**.\n"
            f"{special_reward_message}\n"
            f"Daily pets remaining: **{new_daily_pets_remaining}**.\n",
            ephemeral=True
        )

    cursor.execute(prepare_query(
        "UPDATE user_rewards SET balance = ?, daily_pets_remaining = ?, last_pet_date = ? WHERE user_id = ?"
    ), (new_balance, new_daily_pets_remaining, today, user_id))
    conn.commit()

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

@bot.tree.command(name="add_pets", description="Admin command to grant extra pets to a user.")
@commands.has_permissions(administrator=True)
async def add_pets(interaction: discord.Interaction, user: discord.Member, pets: int):
    # Check if the user running the command has admin permissions
    if not is_admin(interaction):
        await interaction.response.send_message("You need admin permissions to run this command.", ephemeral=True)
        return
    if pets <= 0:
        await interaction.response.send_message("Number of pets must be greater than 0.", ephemeral=True)
        return

    user_id = user.id

    # Fetch current daily pets remaining for the user
    cursor.execute(prepare_query(
        "SELECT daily_pets_remaining FROM user_rewards WHERE user_id = ?"
    ), (user_id,))
    user_data = cursor.fetchone()

    if user_data:
        new_pets_remaining = user_data[0] + pets
        cursor.execute(prepare_query(
            "UPDATE user_rewards SET daily_pets_remaining = ? WHERE user_id = ?"
        ), (new_pets_remaining, user_id))
    else:
        new_pets_remaining = pets + 1
        # If the user does not exist, initialize them with the extra pets
        cursor.execute(prepare_query(
            "INSERT INTO user_rewards (user_id, balance, daily_pets_remaining, last_pet_date) VALUES (?, ?, ?, ?)"
        ), (user_id, 0, pets, None))

    conn.commit()

    await interaction.response.send_message(
        f"Added {pets} extra pets for {user.mention}. They now have {new_pets_remaining} pets remaining.",
        ephemeral=False
    )

@bot.tree.command(name="petting_stats", description="View petting statistics (Admin only)")
@commands.has_permissions(administrator=True)
async def petting_stats(interaction: discord.Interaction):
    # Check if the user running the command is an admin
    if not is_admin(interaction):
        await interaction.response.send_message("You need admin permissions to run this command.", ephemeral=True)
        return
    today = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d")

    # Fetch the number of unique users who petted today
    cursor.execute(prepare_query(
        "SELECT COUNT(DISTINCT user_id) FROM user_rewards WHERE last_pet_date = ?"
    ), (today,))
    daily_active_users = cursor.fetchone()[0]

    # Fetch total unclaimed rewards (sum of all balances)
    cursor.execute(prepare_query(
        "SELECT SUM(balance) FROM user_rewards"
    ))
    total_unclaimed_rewards = cursor.fetchone()[0] or 0  # Default to 0 if None

    # Fetch top 10 users by balance
    cursor.execute(prepare_query(
        "SELECT user_id, balance FROM user_rewards ORDER BY balance DESC LIMIT 10"
    ))
    top_users = cursor.fetchall()

    # Format top users list
    top_users_text = "\n".join([f"<@{user_id}> : {balance} $MVP" for user_id, balance in top_users])

    # Build response message
    stats_message = (
        f"📊 **Petting Stats** 📊\n"
        f"**Daily active petting users today:** {daily_active_users}\n"
        f"**Total active unclaimed rewards:** {total_unclaimed_rewards} $MVP\n\n"
        f"🏆 **Top 10 User Balances:**\n{top_users_text if top_users else 'No users yet.'}"
    )

    # Send response
    await interaction.response.send_message(stats_message, ephemeral=True)

@bot.tree.command(name="add_petting_reward", description="(Admin) Add a special petting reward.")
@commands.has_permissions(administrator=True)
async def add_petting_reward(interaction: discord.Interaction, name: str, probability: float, amount: int):
    # Check if the user running the command is an admin
    if not is_admin(interaction):
        await interaction.response.send_message("You need admin permissions to run this command.", ephemeral=True)
        return
    if probability <= 0 or probability > 1:
        await interaction.response.send_message("Probability must be between 0 and 1.", ephemeral=True)
        return
    if amount <= 0:
        await interaction.response.send_message("Amount must be greater than 0.", ephemeral=True)
        return

    cursor.execute(prepare_query(
        "INSERT INTO special_rewards (name, probability, amount) VALUES (?, ?, ?)"
    ), (name, probability, amount))
    conn.commit()

    await interaction.response.send_message(
        f"✅ Added special reward **{name}** with {amount} available and {probability * 100}% hit chance per pet.",
        ephemeral=True
    )

@bot.tree.command(name="list_petting_rewards", description="(Admin) List all active special petting rewards.")
@commands.has_permissions(administrator=True)
async def list_petting_rewards(interaction: discord.Interaction):
    # Check if the user running the command is an admin
    if not is_admin(interaction):
        await interaction.response.send_message("You need admin permissions to run this command.", ephemeral=True)
        return
    # Fetch all special rewards from the database
    cursor.execute(prepare_query("SELECT name, probability, amount FROM special_rewards"))
    rewards = cursor.fetchall()

    if not rewards:
        await interaction.response.send_message("There are no active special petting rewards.", ephemeral=True)
        return

    # Format the rewards into a list
    reward_list = "\n".join([f"**{name}** - {probability * 100:.3f}% chance - {amount} left" for name, probability, amount in rewards])

    # Send the formatted list
    await interaction.response.send_message(
        f"📜 **Active Special Petting Rewards:**\n{reward_list}",
        ephemeral=True
    )

@bot.tree.command(
    name="gift_leaderboard",
    description="Show Swapfest leaderboard by total gifted points in event period"
)
async def gift_leaderboard(interaction: discord.Interaction):
    # Define the event window in UTC
    start_time = '2025-07-01 21:00:00'
    end_time = '2025-07-11 21:00:00'

    # Query with time filter
    cursor.execute(prepare_query('''
        SELECT from_address, SUM(points) AS total_points
        FROM gifts
        WHERE timestamp BETWEEN ? AND ?
        GROUP BY from_address
        ORDER BY total_points DESC
        LIMIT 20
    '''), (start_time, end_time))
    rows = cursor.fetchall()

    if not rows:
        await interaction.response.send_message(
            "No gift records found in the event period.",
            ephemeral=True
        )
        return

    # Format leaderboard with wallet-to-username mapping
    leaderboard_lines = ["🎁 **Swapfest Gift Leaderboard** 🎁"]
    leaderboard_lines.append(f"_Between {start_time} UTC and {end_time} UTC_\n")
    for i, (from_address, total_points) in enumerate(rows, start=1):
        username = map_wallet_to_username(from_address)
        leaderboard_lines.append(f"{i}. `{username}` : **{total_points} points**")

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
            LIMIT 20
        ''')
        cursor.execute(query, (from_address,))
    else:
        query = prepare_query('''
            SELECT txn_id, moment_id, from_address, points, timestamp
            FROM gifts
            ORDER BY timestamp DESC
            LIMIT 20
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
    FLOW_ACCOUNT = "0xf853bd09d46e7db6"

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


@bot.tree.command(name="pull_fastbreak_horse_stats", description="Admin only: Pull and store new FastBreaks and their rankings.")
@app_commands.checks.has_permissions(administrator=True)
async def pull_fastbreak_horse_stats(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=True)

    if not is_admin(interaction):
        await interaction.followup.send("You need admin permissions to run this command.", ephemeral=True)
        return

    new_fastbreaks = []
    new_rankings_count = 0

    # Step 1: Fetch FastBreak runs
    runs = extract_fastbreak_runs()

    for run in runs[:7]:

        if run['fastBreaks'] and not run['runName'].endswith('Pro'):
            continue
        run_name = run.get('runName', '')
        for fb in run.get('fastBreaks', []):
            if not fb or fb.get('status') != 'FAST_BREAK_FINISHED':
                continue

            fb_id = fb.get('id')
            game_date = fb.get('gameDate')
            status = fb.get('status')

            # Check if already in DB
            cursor.execute(prepare_query('SELECT 1 FROM fastbreaks WHERE id = ?'), (fb_id,))
            if cursor.fetchone():
                continue  # already exists

            # Insert FastBreak into DB
            cursor.execute(prepare_query('''
                INSERT INTO fastbreaks (id, game_date, run_name, status)
                VALUES (?, ?, ?, ?)
            '''), (fb_id, game_date, run_name, status))
            new_fastbreaks.append({
                'id': fb_id,
                'game_date': game_date,
                'run_name': run_name
            })

            # Step 2: Immediately pull and insert rankings
            new_rankings_count += len(pull_rankings_for_fb(fb_id))
            print(f"✅ FastBreak {fb_id} stored with {new_rankings_count} rankings.")

    conn.commit()

    cursor.execute("REFRESH MATERIALIZED VIEW user_rankings_summary")
    conn.commit()

    await interaction.followup.send(
        f"✅ Pulled {len(new_fastbreaks)} new finished FastBreaks and {new_rankings_count} total rankings.",
        ephemeral=True
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