"""
JokicGuess Main Application
Flask + Discord Bot Integration
"""

import os
import threading
import discord
from discord.ext import commands
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


# Initialize Discord bot
intents = discord.Intents.default()
intents.members = True
intents.message_content = True
bot = commands.Bot(command_prefix='/', intents=intents)


# Register Discord bot commands
register_commands(bot, conn, cursor, db_type)


@bot.event
async def on_ready():
    """Bot startup event handler."""
    await bot.tree.sync()
    print(f'Logged in as {bot.user}! Commands synced.')
    # bot.loop.create_task(swapfest.main())


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
