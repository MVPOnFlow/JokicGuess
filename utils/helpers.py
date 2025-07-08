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
        f"Your horse turned water into $MVP. You get **{amount} $MVP**. Call it a miracle.",
        f"Your horse cracked a cold one with the boys and found **{amount} $MVP** in the cooler.",
        f"Your horse rubbed a blockchain lamp. A genie gave it **{amount} $MVP** — and you, too.",
        f"Your horse solved a complex on-chain puzzle mid-pet and rewarded you with **{amount} $MVP**.",
        f"A sparkle appeared in your horse’s eye. Moments later, you’re holding **{amount} $MVP**.",
        f"Your horse summoned Satoshi’s spirit and got blessed with **{amount} $MVP**.",
        f"After the pet, your horse whispered ‘hodl’ and handed you **{amount} $MVP**.",
        f"The horse did a little tap dance and out popped **{amount} $MVP**. Don’t question it.",
        f"You pet your horse. It winked, neighed, and poof — **{amount} $MVP** in your wallet.",
        f"A rainbow formed over your stable. At the end of it? **{amount} $MVP**.",
        f"Your horse went full DeFi and airdropped you **{amount} $MVP**.",
        f"After the pet, your horse checked the charts and decided you earned **{amount} $MVP**.",
        f"Your horse hacked the mainframe using just its tail and gifted you **{amount} $MVP**.",
        f"You pet your horse gently. It neighed in Morse code: '**{amount} $MVP** incoming.'",
        f"The blockchain neigh-tion confirmed the transaction: **{amount} $MVP** to you.",
        f"Your horse spun in a circle, kicked the air, and materialized **{amount} $MVP**.",
        f"You pet the horse and it responded with a bow — and a gift of **{amount} $MVP**.",
        f"A tiny door opened under your horse’s hoof. Inside? A treasure chest of **{amount} $MVP**.",
        f"Your horse took a break from farming stablecoins and handed you **{amount} $MVP**.",
        f"You pet the horse. It briefly turned into a unicorn and sneezed out **{amount} $MVP**.",
        f"Your horse wrote a smart contract in the sand and executed: reward = **{amount} $MVP**.",
        f"After the petting, your horse gave you a look that said ‘check your wallet’. Boom — **{amount} $MVP**.",
        f"You pet your horse. It stared off into the distance... then casually dropped **{amount} $MVP**.",
    ]
    return random.choice(responses)

def get_last_processed_block():
    cursor.execute(prepare_query("SELECT value FROM scraper_state WHERE key = ?"), ('last_block',))
    row = cursor.fetchone()
    if row:
        return int(row[0])
    else:
        return 118542742

def save_last_processed_block(block_height):
    if db_type == 'postgresql':
        cursor.execute(prepare_query('''
            INSERT INTO scraper_state (key, value)
            VALUES (?, ?)
            ON CONFLICT (key)
            DO UPDATE SET value = EXCLUDED.value
        '''), ('last_block', str(block_height)))
    else:

        cursor.execute(prepare_query('''
            INSERT OR REPLACE INTO scraper_state (key, value)
            VALUES (?, ?)
        '''), ('last_block', str(block_height)))
    conn.commit()

def reset_last_processed_block(block_height):
    if db_type == 'postgresql':
        # Delete all existing state
        cursor.execute(prepare_query('DELETE FROM scraper_state'))

        # Insert the new last_block value
        cursor.execute(prepare_query('''
            INSERT INTO scraper_state (key, value)
            VALUES (?, ?)
        '''), ('last_block', str(block_height)))

    else:
        # Same for SQLite
        cursor.execute(prepare_query('DELETE FROM scraper_state'))

        cursor.execute(prepare_query('''
            INSERT INTO scraper_state (key, value)
            VALUES (?, ?)
        '''), ('last_block', str(block_height)))

    conn.commit()


def save_gift(txn_id, moment_id, from_address, points, timestamp):
    if db_type == 'postgresql':
        cursor.execute(prepare_query('''
            INSERT INTO gifts (txn_id, moment_id, from_address, points, timestamp)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (txn_id) DO NOTHING
        '''), (txn_id, moment_id, from_address, points, timestamp))
    else:
        cursor.execute(prepare_query('''
            INSERT OR IGNORE INTO gifts (txn_id, moment_id, from_address, points, timestamp)
            VALUES (?, ?, ?, ?, ?)
        '''), (txn_id, moment_id, from_address, points, timestamp))
    conn.commit()


WALLET_USERNAME_MAP = {
    '0xc246d05ba775362e': 'KnotBean',
    '0xbf3286046c76cf86': 'wildrick',
    '0x6877b9930f77d002': 'lframpton',
    '0xdad344d00b889de2': 'td808486',
    '0x334a20bbaa7f2801': 'bobobobo',
    '0x9139bb1a42df770b': 'funguy626',
    '0x63872cb44c7774ae': 'Nolan11',
    '0xd0a5910478602d19': 'ChewieWoolf',
    '0x84387b2cd4617bf3': 'sutych',
    '0x536319d7c0a35e41': 'DCMG',
    '0x2cba71ed9d39be5e': 'Ghost',
    '0x301707d6688771b3': 'jared3',
    '0x1381915616f894fb': 'Jammerz',
    '0xbf47fb44c6cbb622': 'CryptoSteve',
    '0xc1b3a6504566a1bd': 'WaXimus',
    '0x70c0cb528d3bfaed': 'waybeyondthearchive',
    '0x9a620aac275d4ba6': 'massdog23',
    '0x52ab4596ce0a9e71': 'RichDMC',
    '0xf9050403ac603c0f': 'HEART1982',
    '0xe78f452b498da264': 'Liveon2legs',
    '0xf5bc0f596b1b4832': 'Eagleputt',
    '0x31007f0d4dc6f5fc': 'Yolodawg',
    '0xde669e0351f4d7b7': 'thatguywithboba',
    '0xecffd6718379ba44': 'JayBKMB',
    '0xd1aa122dad3571f1': 'besuzee',
    '0x26ef73b65a4289e0': 'geebear',
    '0x6822e275997c7132': 'superherbe',
    '0xf47cbab86671a23d': 'rb_duke',
    '0xd0c35e8c3a0a55d8': 'J2jaunty',
    '0xfe5007fe4ddf8f1f': 'AlexEnglish',
    '0xfb17f3345ae0f266': 'Bbristle05',
    '0x1e14b8a08b6c9615': 'kidbamboo73',
    '0x32c66e4278279976': 'mxtthxw',
    '0x525bbc8ea4a0943e': 'Coach_P0625',
    '0xd4100270a1a94ee1': 'schokobub',
    '0x4974f6a62def220c': 'BrendanMcDonnell',
    '0x1c9d5e0c22f96c16': 'Rightmow',
    '0x5557ee9826c54f6b': 'steviewonder88',
    '0x507df728a5d2e605': 'heffery',
    '0x78b51f4b7ccfd55c': 'bumsterNFT',
    '0x17d63446b1e38e09': 'EXCITED_MEERKAT',
    '0xfab01b00f2fab997': 'JTadashi',
    '0xcd80f4ce7a7c6000': 'NamePrime',
    '0x81bd218152d277dd': 'FlyingNinja',
    '0xe8d73b51dc45f497': 'wolfdizzle',
    '0x2da11e06e379fcf4': 'tfire',
    '0x3845ab9cbd7f4e4b': 'Psyduck27',
    '0x20183de3f208bf34': 'CrazyAndy',
    '0xff272db64671ce5f': 'Codester_3',
    '0x3c06e34f5cff1b66': 'Candek',
    '0xf7220734e22dd14a': 'RBL',
    '0x1537f0c54ebe4aa1': 'mileah09',
    '0x0d6ab229aa569864': 'BrodeKY2955',
    '0xb5a2d654b28dcf76': 'SingaBas',
    '0xf20dea544888cdc7': 'purebull',
    '0xcaff3188e88683dc': 'stephenlaywon',
    '0xc1c8d9a1bbb4e296': 'thomasmmm',
    '0x678a8a0126d3516b': 'Alix49',
    '0x452be065d1ed663c': 'Kiel17',
    '0xb4da21808155485d': 'crazyzeus',
    '0xca87efe2e0da6297': 'Agent00',
    '0xd6641d89e6372ee1': 'leet3',
}

def map_wallet_to_username(wallet_address: str) -> str:
    """
    Maps a Dapper wallet address to a username if known.
    Otherwise, returns the wallet itself.
    """
    return WALLET_USERNAME_MAP.get(wallet_address.lower(), wallet_address)


def ordinal(n):
    if 10 <= n % 100 <= 20:
        suffix = 'th'
    else:
        suffix = {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')
    return f"{n}{suffix}"