"""One-time script to seed a live bracket tournament."""
from db.init import get_db_connection, initialize_database

conn, db_type = get_db_connection()
cursor = conn.cursor()

# Ensure tables exist
initialize_database(conn, db_type)

# Drop existing data so this script is idempotent
cursor.execute("DELETE FROM bracket_matchups")
cursor.execute("DELETE FROM bracket_participants")
cursor.execute("DELETE FROM bracket_tournaments")
conn.commit()

# Signup closes March 27, 2026 at 11:59 PM UTC
close_ts = 1774915140

if db_type == 'postgresql':
    cursor.execute(
        "INSERT INTO bracket_tournaments (name, fee_amount, fee_currency, signup_close_ts, status, current_round)"
        " VALUES (%s, %s, %s, %s, 'SIGNUP', 0) RETURNING id",
        ('Fastbreak Bracket #1 — March Madness', 5, '$MVP', close_ts)
    )
    tid = cursor.fetchone()[0]
else:
    # SQLite: SERIAL doesn't auto-increment like INTEGER, so specify id explicitly
    cursor.execute(
        "INSERT INTO bracket_tournaments (id, name, fee_amount, fee_currency, signup_close_ts, status, current_round)"
        " VALUES (1, ?, ?, ?, ?, 'SIGNUP', 0)",
        ('Fastbreak Bracket #1 \u2014 March Madness', 5, '$MVP', close_ts)
    )
    tid = 1

conn.commit()
conn.close()
print(f'Created tournament id={tid}, signup closes at {close_ts} (March 27 2026 23:59 UTC)')
