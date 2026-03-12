"""Seed a DEFAULT raffle with treasury wallet entries for payout testing."""
import sqlite3, time

conn = sqlite3.connect("local.db")
c = conn.cursor()

# Migrate columns if missing
for stmt in [
    "ALTER TABLE raffles ADD COLUMN raffle_type TEXT NOT NULL DEFAULT 'DEFAULT'",
    "ALTER TABLE raffle_winners ADD COLUMN payout_amount REAL DEFAULT 0",
    "ALTER TABLE raffle_winners ADD COLUMN payout_tx_id TEXT",
]:
    try:
        c.execute(stmt)
        conn.commit()
    except Exception:
        pass

now = int(time.time())
end = now + 600  # 10 minutes

c.execute(
    "INSERT INTO raffles (name, description, num_winners, end_time, status, raffle_type, created_at) "
    "VALUES (?, ?, ?, ?, 'OPEN', 'DEFAULT', ?)",
    ("Payout Test Raffle", "Testing automatic 50/30/15 payout", 3, end, now),
)
raffle_id = c.lastrowid

wallet = "0xcc4b6fa5550a4610"
c.execute(
    "INSERT INTO raffle_entries (raffle_id, wallet_address, num_entries, tx_id, created_at) "
    "VALUES (?, ?, ?, ?, ?)",
    (raffle_id, wallet, 20, "test_seed_tx_001", now),
)
conn.commit()
conn.close()

import datetime
print(f"Created DEFAULT raffle #{raffle_id}: 20 entries from {wallet}, ends in 10 min")
print(f"Draw time: {datetime.datetime.utcfromtimestamp(end).strftime('%H:%M:%S UTC')}")
