"""Database initialization and schema creation."""

import psycopg2
import sqlite3
from config import DATABASE_URL
from utils.helpers import prepare_query


def get_db_connection():
    """Create and return a database connection based on environment."""
    if DATABASE_URL:
        # On Heroku/Azure, use PostgreSQL
        conn = psycopg2.connect(DATABASE_URL, sslmode='require')
        db_type = 'postgresql'
    else:
        # Locally, use SQLite
        conn = sqlite3.connect('local.db', check_same_thread=False)
        db_type = 'sqlite'
    
    return conn, db_type


def initialize_database(conn, db_type):
    """Initialize all database tables and views."""
    cursor = conn.cursor()

    # Create table for predictions
    cursor.execute(prepare_query('''
        CREATE TABLE IF NOT EXISTS predictions (
            user_id BIGINT,
            contest_name TEXT,
            stats TEXT NOT NULL,
            outcome TEXT NOT NULL CHECK (outcome IN ('Win', 'Loss')),
            timestamp BIGINT NOT NULL
        )
    '''))
    conn.commit()

    # Create table for contests
    cursor.execute(prepare_query('''
        CREATE TABLE IF NOT EXISTS contests (
            channel_id BIGINT PRIMARY KEY,
            contest_name TEXT NOT NULL,
            start_time BIGINT NOT NULL,
            creator_id BIGINT NOT NULL
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

    # Create scraper_state table
    cursor.execute(prepare_query('''
        CREATE TABLE IF NOT EXISTS scraper_state (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    '''))
    conn.commit()

    # Create table for user mapping
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
            user_id BIGINT PRIMARY KEY,
            balance REAL NOT NULL DEFAULT 0,
            daily_pets_remaining INTEGER NOT NULL DEFAULT 1,
            last_pet_date TEXT
        )
    '''))
    conn.commit()

    # Create special rewards table
    cursor.execute(prepare_query('''
        CREATE TABLE IF NOT EXISTS special_rewards (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            probability REAL NOT NULL,
            amount INTEGER
        )
    '''))
    conn.commit()

    # Create fastbreak contests table
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

    # Create fastbreak contest entries table
    cursor.execute(prepare_query('''
        CREATE TABLE IF NOT EXISTS fastbreakContestEntries (
            id SERIAL PRIMARY KEY,
            contest_id INTEGER REFERENCES fastbreakContests(id),
            topshotUsernamePrediction TEXT NOT NULL,
            userWalletAddress TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    '''))
    conn.commit()

    # Create fastbreaks table
    cursor.execute(prepare_query('''
        CREATE TABLE IF NOT EXISTS fastbreaks (
            id TEXT PRIMARY KEY,
            game_date TEXT,
            run_name TEXT,
            status TEXT
        )
    '''))
    conn.commit()

    # Create fastbreak rankings table
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

    # PostgreSQL-specific setup
    if db_type == "postgresql":
        cursor.execute("DROP MATERIALIZED VIEW IF EXISTS user_rankings_summary")
        conn.commit()
        cursor.execute("""
            CREATE MATERIALIZED VIEW user_rankings_summary AS
            WITH ranked AS (
                SELECT
                    r.username,
                    r.rank,
                    r.fastbreak_id,
                    f.game_date,
                    ROW_NUMBER() OVER (PARTITION BY r.username ORDER BY f.game_date DESC) AS rn
                FROM fastbreak_rankings r
                JOIN fastbreaks f ON r.fastbreak_id = f.id
            )
            SELECT
                username,
                COUNT(*) AS total_entries,
                MIN(rank) AS best,
                ROUND(AVG(rank)::numeric, 2) AS mean
            FROM ranked
            WHERE rn <= 15
            GROUP BY username
        """)
        conn.commit()
        try:
            cursor.execute(prepare_query('''
                ALTER TABLE fastbreak_rankings
                ADD CONSTRAINT unique_fb_user UNIQUE (fastbreak_id, username);
            '''))
        except:
            pass
        conn.commit()
    else:
        # SQLite-specific setup
        cursor.execute(prepare_query('''
            CREATE VIEW IF NOT EXISTS user_rankings_summary AS
            SELECT username,
                COUNT(*) AS total_entries,
                MIN(rank) AS best,
                ROUND(AVG(rank), 2) AS mean
            FROM fastbreak_rankings
            GROUP BY username
        '''))

        cursor.execute(prepare_query('''
            CREATE INDEX IF NOT EXISTS idx_fastbreak_rankings_username
                ON fastbreak_rankings(username)
        '''))
        conn.commit()

    return cursor
