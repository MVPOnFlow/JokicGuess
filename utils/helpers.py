from enum import Enum
import csv
import io
import os
import sqlite3
import psycopg2
import random

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

# Define the Outcome Enum
class Outcome(Enum):
    WIN = "Win"
    LOSS = "Loss"

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
        '''), (channel_id, contest_name, start_time, creator_id))
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

# Function to count total predictions for a specific contest channel
def count_total_predictions(channel_id):
    query = '''
        SELECT COUNT(*) 
        FROM predictions 
        WHERE contest_name IN (
            SELECT contest_name 
            FROM contests 
            WHERE channel_id = ?
        )
    '''
    # Prepare the query using the channel_id as a parameter
    cursor.execute(prepare_query(query), (channel_id,))
    return cursor.fetchone()[0]  # Return the count

# Helper function to adjust query placeholders
def prepare_query(query):
    if db_type == 'postgresql':
        # Replace SQLite-style `?` with PostgreSQL-style `%s`
        return query.replace('?', '%s')
    return query  # SQLite uses `?`, so no replacement needed

def is_admin(interaction):
    # Check if the user running the command has admin permissions
    return interaction.user.guild_permissions.administrator

def custom_reward():
    #Generate reward value
    random_choice = random.random()  # Random number to determine which range to sample from

    if random_choice < 0.8:
        reward = random.uniform(0.01, 0.1)
    elif random_choice < 0.95:
        reward = random.uniform(0.1, 0.5)
    else:
        reward = random.uniform(0.5, 1)
    return round(reward, 2)

def get_basic_pet_response(amount):
    responses = [
        f"Your horse galloped into a crypto vault and came back with **{amount} $MVP**. What a legend!",
        f"After a solid petting session, your horse nodded in approval and dropped **{amount} $MVP** at your feet.",
        f"Your horse teleported to the blockchain dimension and mined **{amount} $MVP** just for you!",
        f"A unicorn saw how well you treat your horse and gifted you **{amount} $MVP**.",
        f"Your horse just sold an NFT of its tail. You got **{amount} $MVP** from the deal.",
        f"Your horse moonwalked across the pasture and somehow earned **{amount} $MVP**. Don't question it.",
        f"After intense cuddles, your horse muttered, 'You're the GOAT,' and hoofed over **{amount} $MVP**.",
        f"Your horse just did your taxes and found **{amount} $MVP** in crypto refunds. 🐴💰",
        f"The Horse Council of Elders has blessed you with **{amount} $MVP** for outstanding petting technique.",
        f"You pet your horse. Your horse blinked twice. Moments later, your wallet glowed with **{amount} $MVP**.",
        f"Your horse entered a Discord meme contest and won **{amount} $MVP**. Neigh-sayers be quiet.",
        f"You pet your horse so well it started mining on-chain. Boom — **{amount} $MVP**.",
        f"Your horse hacked the Matrix, whispered 'WAGMI,' and handed you **{amount} $MVP**.",
        f"Your horse manifested pure value from the ether and it became **{amount} $MVP**. Alchemy is real.",
        f"A wild Top Shot moment appeared. Your horse sold it instantly. You now have **{amount} $MVP**.",
        f"Your horse opened a DAO proposal titled 'Give my human **{amount} $MVP**.' It passed unanimously.",
        f"Your horse challenged Vitalik to chess and won. The prize? **{amount} $MVP**.",
        f"You pet your horse with such finesse it unlocked a secret wallet with **{amount} $MVP**.",
        f"While grooming, your horse muttered 'bull run' and handed you **{amount} $MVP**.",
        f"Your horse just rug pulled another stable and shared the loot: **{amount} $MVP**.",
        f"An ancient prophecy foretold this moment: **{amount} $MVP** for the chosen horse petter.",
        f"Your horse got sponsored by Horsecoin. You received a welcome bonus of **{amount} $MVP**.",
        f"Your horse galloped through a liquidity pool and came out with **{amount} $MVP**.",
        f"A blockchain oracle whispered secrets to your horse. You gained **{amount} $MVP**.",
        f"Your horse performed a flawless TikTok dance. It went viral and earned **{amount} $MVP**.",
        f"Your horse just flipped a rare Jokic moment for **{amount} $MVP** profit.",
        f"After a quick trip to Flowverse, your horse brought back **{amount} $MVP** and a mango smoothie.",
        f"You pet your horse and it responded with a deep philosophical quote and **{amount} $MVP**.",
        f"Your horse blinked in morse code: 'Buy MVP, pet horse, repeat.' Then dropped **{amount} $MVP**.",
        f"A random smart contract just airdropped **{amount} $MVP** to your horse for being adorable.",
        f"Your horse got featured on a Flow blockchain documentary. You got royalties — **{amount} $MVP**.",
        f"Your horse used its racing winnings to invest in stablecoins. Here's your share: **{amount} $MVP**.",
        f"You pet your horse. The blockchain smiled. **{amount} $MVP** appeared.",
        f"Your horse just launched an NFT project. Pre-sale sold out. You earned **{amount} $MVP**.",
        f"Your horse snuck into a validator meeting and came back with **{amount} $MVP** in hush money.",
        f"Your horse whispered 'hodl' and hoofed over **{amount} $MVP** with a smirk.",
        f"You pet your horse. Somewhere, an algorithm rewarded you with **{amount} $MVP**.",
        f"Your horse turned water into $MVP. You get *{amount} $MVP**. Call it a miracle.",
        f"Your horse cracked a cold one with the boys and found **{amount} $MVP** in the cooler.",
        f"Your horse rubbed a blockchain lamp. A genie gave it **{amount} $MVP** — and you, too."
    ]
    return random.choice(responses)