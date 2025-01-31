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

