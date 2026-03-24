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


def get_bot_db(bot):
    """Get a working (conn, cursor) pair for bot commands.

    Creates a fresh cursor from the current connection.
    If the connection is dead, reconnects automatically.
    """
    try:
        cursor = bot.db_conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        return bot.db_conn, cursor
    except Exception:
        try:
            bot.db_conn.close()
        except Exception:
            pass
        bot.db_conn, bot.db_type = get_db_connection()
        cursor = bot.db_conn.cursor()
        return bot.db_conn, cursor


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

    # Create blog comments table
    cursor.execute(prepare_query('''
        CREATE TABLE IF NOT EXISTS blog_comments (
            id SERIAL PRIMARY KEY,
            article_id TEXT NOT NULL,
            author_name TEXT NOT NULL,
            comment_text TEXT NOT NULL,
            timestamp BIGINT NOT NULL,
            parent_id INTEGER,
            FOREIGN KEY (parent_id) REFERENCES blog_comments(id)
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

    # ── Jokic editions table (swap feature) ──
    cursor.execute(prepare_query('''
        CREATE TABLE IF NOT EXISTS jokic_editions (
            edition_id TEXT PRIMARY KEY,
            play_id TEXT NOT NULL,
            play_flow_id INTEGER,
            set_id TEXT NOT NULL,
            set_flow_id INTEGER,
            tier TEXT NOT NULL,
            set_name TEXT,
            series_number INTEGER,
            play_category TEXT,
            play_headline TEXT,
            player_name TEXT DEFAULT 'Nikola Jokić',
            team TEXT,
            date_of_moment TEXT,
            nba_season TEXT,
            jersey_number TEXT,
            image_url TEXT,
            video_url TEXT,
            circulation_count INTEGER,
            low_ask REAL,
            updated_at BIGINT
        )
    '''))
    conn.commit()

    cursor.execute(prepare_query('''
        CREATE TABLE IF NOT EXISTS jokic_moments (
            moment_id BIGINT PRIMARY KEY,
            edition_id TEXT,
            play_id TEXT,
            set_id TEXT,
            serial_number INTEGER,
            tier TEXT,
            cached_at BIGINT
        )
    '''))
    conn.commit()

    # ── Completed swaps table (replay protection) ──
    cursor.execute(prepare_query('''
        CREATE TABLE IF NOT EXISTS completed_swaps (
            tx_id TEXT PRIMARY KEY,
            user_addr TEXT NOT NULL,
            moment_ids TEXT NOT NULL,
            mvp_amount REAL NOT NULL,
            mvp_tx_id TEXT,
            completed_at BIGINT NOT NULL,
            points INTEGER NOT NULL DEFAULT 0
        )
    '''))
    conn.commit()

    # Migration: add points column if it doesn't exist yet
    try:
        cursor.execute(prepare_query(
            "ALTER TABLE completed_swaps ADD COLUMN points INTEGER NOT NULL DEFAULT 0"
        ))
        conn.commit()
    except Exception:
        pass  # column already exists

    # ── Fastbreak Bracket tables ──
    serial_pk = 'INTEGER PRIMARY KEY AUTOINCREMENT' if db_type == 'sqlite' else 'SERIAL PRIMARY KEY'
    cursor.execute(prepare_query(f'''
        CREATE TABLE IF NOT EXISTS bracket_tournaments (
            id {serial_pk},
            name TEXT NOT NULL,
            fee_amount NUMERIC NOT NULL DEFAULT 5,
            fee_currency TEXT NOT NULL DEFAULT '$MVP',
            signup_close_ts BIGINT NOT NULL,
            status TEXT NOT NULL DEFAULT 'SIGNUP',
            current_round INTEGER NOT NULL DEFAULT 0,
            winner_wallet TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    '''))
    conn.commit()

    cursor.execute(prepare_query(f'''
        CREATE TABLE IF NOT EXISTS bracket_participants (
            id {serial_pk},
            tournament_id INTEGER NOT NULL,
            wallet_address TEXT NOT NULL,
            ts_username TEXT,
            seed_number INTEGER,
            eliminated_in_round INTEGER,
            signed_up_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (tournament_id, wallet_address)
        )
    '''))
    conn.commit()

    cursor.execute(prepare_query(f'''
        CREATE TABLE IF NOT EXISTS bracket_matchups (
            id {serial_pk},
            tournament_id INTEGER NOT NULL,
            round_number INTEGER NOT NULL,
            match_index INTEGER NOT NULL,
            player1_wallet TEXT,
            player2_wallet TEXT,
            player1_score INTEGER,
            player2_score INTEGER,
            player1_rank INTEGER,
            player2_rank INTEGER,
            player1_lineup TEXT,
            player2_lineup TEXT,
            winner_wallet TEXT,
            fastbreak_id TEXT,
            status TEXT NOT NULL DEFAULT 'PENDING'
        )
    '''))
    conn.commit()

    cursor.execute(prepare_query(f'''
        CREATE TABLE IF NOT EXISTS bracket_rounds (
            id {serial_pk},
            tournament_id INTEGER NOT NULL,
            round_number INTEGER NOT NULL,
            fastbreak_id TEXT NOT NULL,
            game_date TEXT NOT NULL,
            UNIQUE (tournament_id, round_number)
        )
    '''))
    conn.commit()

    # ── One-time seed: populate jokic_editions if empty ──
    try:
        cursor.execute(prepare_query("SELECT COUNT(*) FROM jokic_editions"))
        row = cursor.fetchone()
        if row and row[0] == 0:
            _seed_jokic_editions(conn, db_type)
    except Exception:
        pass  # table may not exist yet in test mocks

    return cursor


def _seed_jokic_editions(conn, db_type):
    """Fetch all Jokic editions from TopShot and insert into jokic_editions.

    Runs once on first deploy when the table is empty.
    """
    import time
    from utils.helpers import get_jokic_editions

    print("🌱 jokic_editions is empty — seeding from TopShot…")
    result = get_jokic_editions()

    if result.get("error"):
        print(f"  ⚠️  Warning: {result['error']}")

    editions = result.get("editions", [])
    print(f"  📦 Got {len(editions)} editions")
    if not editions:
        return

    cursor = conn.cursor()
    now = int(time.time())
    count = 0

    for ed in editions:
        edition_id = ed.get("id", "")
        play_id = str(ed.get("playId", ""))
        set_id = str(ed.get("setId", ""))
        if not edition_id or not play_id or not set_id:
            continue

        params = (
            edition_id, play_id, ed.get("playFlowId"), set_id, ed.get("setFlowId"),
            ed.get("tier", "COMMON"), ed.get("setName", ""), ed.get("seriesNumber"),
            ed.get("playCategory", ""),
            ed.get("shortDescription") or ed.get("description", ""),
            ed.get("playerName", "Nikola Jokić"), ed.get("teamAtMoment", ""),
            ed.get("dateOfMoment", ""), ed.get("nbaSeason", ""),
            ed.get("jerseyNumber", ""), ed.get("imageUrl", ""),
            ed.get("videoUrl", ""), ed.get("circulationCount"),
            ed.get("lowAsk"), now,
        )

        if db_type == "postgresql":
            cursor.execute(
                """INSERT INTO jokic_editions
                   (edition_id, play_id, play_flow_id, set_id, set_flow_id,
                    tier, set_name, series_number,
                    play_category, play_headline, player_name, team, date_of_moment,
                    nba_season, jersey_number, image_url, video_url,
                    circulation_count, low_ask, updated_at)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                   ON CONFLICT (edition_id) DO NOTHING""",
                params,
            )
        else:
            cursor.execute(
                """INSERT OR IGNORE INTO jokic_editions
                   (edition_id, play_id, play_flow_id, set_id, set_flow_id,
                    tier, set_name, series_number,
                    play_category, play_headline, player_name, team, date_of_moment,
                    nba_season, jersey_number, image_url, video_url,
                    circulation_count, low_ask, updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                params,
            )
        count += 1

    conn.commit()
    print(f"  ✅ Seeded {count} Jokic editions")
