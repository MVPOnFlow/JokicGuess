"""
JokicGuess Main Application
Flask + Discord Bot Integration
"""

import os
import threading
import time
import random
import discord
from discord.ext import commands, tasks
from flask import Flask
from flask_cors import CORS

import swapfest
from config import DISCORD_TOKEN, FLASK_HOST, FLASK_PORT
from db.init import get_db_connection, initialize_database
from routes.api import register_routes
from bot.commands import register_commands


# Initialize Flask app
app = Flask(__name__)
CORS(app)


# Initialize database
conn, db_type = get_db_connection()
cursor = initialize_database(conn, db_type)


# Register Flask routes
register_routes(app)

# Channel for swap notifications
SWAP_NOTIFY_CHANNEL_ID = 1261666640051966055

# Initialize Discord bot
intents = discord.Intents.default()
intents.members = True
intents.message_content = True
bot = commands.Bot(command_prefix='/', intents=intents)


# Store DB connection on bot for per-command cursor creation
bot.db_conn = conn
bot.db_type = db_type

# Make bot accessible from Flask routes (swap notifications)
app.discord_bot = bot
app.swap_notify_channel_id = SWAP_NOTIFY_CHANNEL_ID

# Register Discord bot commands
register_commands(bot, conn, cursor, db_type)


@bot.event
async def on_ready():
    """Bot startup event handler."""
    await bot.tree.sync()
    print(f'Logged in as {bot.user}! Commands synced.')
    # bot.loop.create_task(swapfest.main())
    if not raffle_draw_loop.is_running():
        raffle_draw_loop.start()


@tasks.loop(seconds=30)
async def raffle_draw_loop():
    """Auto-draw winners for any expired raffles and pay out DEFAULT type."""
    from db.init import get_bot_db
    from utils.helpers import prepare_query
    try:
        c, cur = get_bot_db(bot)
        now = int(time.time())
        cur.execute(prepare_query(
            "SELECT id, num_winners, raffle_type FROM raffles WHERE status = 'OPEN' AND end_time <= ?"
        ), (now,))
        expired = cur.fetchall()

        # Default raffle payout splits
        DEFAULT_PAYOUTS = [0.50, 0.30, 0.15]

        for row in expired:
            raffle_id, num_winners, raffle_type = row
            raffle_type = raffle_type or 'DEFAULT'

            cur.execute(prepare_query(
                "SELECT id, wallet_address, num_entries FROM raffle_entries WHERE raffle_id = ?"
            ), (raffle_id,))
            entry_rows = cur.fetchall()
            tickets = []
            for eid, wallet, n in entry_rows:
                for _ in range(int(n)):
                    tickets.append((eid, wallet))

            pool = float(len(tickets))  # 1 $MVP per ticket

            drawn = []
            if tickets:
                random.shuffle(tickets)
                used = set()
                for _ in range(min(num_winners, len(tickets))):
                    idx = random.randrange(len(tickets))
                    attempts = 0
                    while idx in used and attempts < len(tickets) * 2:
                        idx = random.randrange(len(tickets))
                        attempts += 1
                    if idx in used:
                        break
                    used.add(idx)
                    drawn.append(tickets[idx])

            # Calculate payouts
            payouts = []
            if raffle_type == 'DEFAULT':
                for i in range(len(drawn)):
                    pct = DEFAULT_PAYOUTS[i] if i < len(DEFAULT_PAYOUTS) else 0
                    payouts.append(round(pool * pct, 2))
            else:
                payouts = [0] * len(drawn)

            for i, (entry_id, wallet) in enumerate(drawn):
                cur.execute(prepare_query('''
                    INSERT INTO raffle_winners (raffle_id, wallet_address, entry_id, drawn_at, payout_amount)
                    VALUES (?, ?, ?, ?, ?)
                '''), (raffle_id, wallet, entry_id, now, payouts[i]))

            cur.execute(prepare_query(
                "UPDATE raffles SET status = 'DRAWN' WHERE id = ?"
            ), (raffle_id,))
            c.commit()

            # Send $MVP payouts for DEFAULT type — single multi-transfer tx
            if raffle_type == 'DEFAULT' and drawn:
                to_pay = []  # list of (wallet, amount)
                pay_indices = []  # matching indices into drawn
                for i, (entry_id, wallet) in enumerate(drawn):
                    amount = payouts[i]
                    if amount <= 0:
                        continue
                    to_pay.append((wallet, amount))
                    pay_indices.append(i)

                if to_pay:
                    try:
                        from routes.api import _send_mvp_multi_from_treasury
                        tx_id = await _send_mvp_multi_from_treasury(to_pay)
                        for i in pay_indices:
                            entry_id, wallet = drawn[i]
                            cur.execute(prepare_query(
                                "UPDATE raffle_winners SET payout_tx_id = ? WHERE raffle_id = ? AND wallet_address = ? AND entry_id = ?"
                            ), (tx_id, raffle_id, wallet, entry_id))
                        c.commit()
                        summary = ', '.join(f'{a} to {w}' for w, a in to_pay)
                        print(f"[raffle_payout] Paid raffle #{raffle_id} in 1 tx: {summary} (tx {tx_id})")
                    except Exception as pe:
                        print(f"[raffle_payout] Multi-payout failed for raffle #{raffle_id}: {pe}")

    except Exception as e:
        print(f"[raffle_draw_loop] error: {e}")


@bot.event
async def on_close():
    """Bot shutdown event handler."""
    conn.close()


def run_flask():
    """Run Flask server in a separate thread."""
    app.run(host=FLASK_HOST, port=FLASK_PORT)


if __name__ == "__main__":
    # Start Flask in background thread
    threading.Thread(target=run_flask, daemon=True).start()
    
    # Read Discord token
    token = DISCORD_TOKEN
    if not token:
        try:
            with open('secret.txt', 'r') as file:
                token = file.read().strip()
        except FileNotFoundError:
            raise ValueError("DISCORD_TOKEN not found in environment or secret.txt")
    
    # Run Discord bot (blocking)
    bot.run(token)
