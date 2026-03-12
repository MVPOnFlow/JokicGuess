"""Seed a test raffle with entries into local.db."""
import sqlite3
import time

conn = sqlite3.connect("local.db")
c = conn.cursor()

# Ensure tables
c.execute("""CREATE TABLE IF NOT EXISTS raffles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    num_winners INTEGER NOT NULL DEFAULT 1,
    end_time BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN',
    created_at BIGINT NOT NULL
)""")
c.execute("""CREATE TABLE IF NOT EXISTS raffle_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    raffle_id INTEGER NOT NULL,
    wallet_address TEXT NOT NULL,
    num_entries INTEGER NOT NULL DEFAULT 1,
    mvp_amount REAL NOT NULL DEFAULT 0,
    tx_id TEXT,
    created_at BIGINT NOT NULL
)""")
c.execute("""CREATE TABLE IF NOT EXISTS raffle_winners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    raffle_id INTEGER NOT NULL,
    wallet_address TEXT NOT NULL,
    entry_id INTEGER NOT NULL,
    drawn_at BIGINT NOT NULL
)""")

now = int(time.time())
end = now + 600  # 10 minutes from now

c.execute(
    "INSERT INTO raffles (name, description, num_winners, end_time, status, created_at) VALUES (?,?,?,?,?,?)",
    (
        "Jokic Signed Jersey Giveaway",
        "Win a signed Nikola Jokic #15 Nuggets jersey! Enter with $MVP for a chance to win.",
        2,
        end,
        "OPEN",
        now,
    ),
)
rid = c.lastrowid

wallets = [
    ("0x1a2b3c4d5e6f7890", 5),
    ("0xaabbccdd11223344", 3),
    ("0xdeadbeef00000001", 10),
    ("0x9876543210abcdef", 2),
    ("0xf853bd09d46e7db6", 7),
    ("0x1111222233334444", 1),
    ("0xabcdef1234567890", 4),
]

for i, (wallet, qty) in enumerate(wallets):
    c.execute(
        "INSERT INTO raffle_entries (raffle_id, wallet_address, num_entries, mvp_amount, tx_id, created_at) VALUES (?,?,?,?,?,?)",
        (rid, wallet, qty, float(qty), f"fake_tx_{rid}_{i}", now - 300 + i * 30),
    )

conn.commit()
total = sum(q for _, q in wallets)
print(f"Raffle #{rid} created — ends in 10 min (ts {end})")
print(f"  {len(wallets)} entrants, {total} total tickets, 2 winners to be drawn")
conn.close()
