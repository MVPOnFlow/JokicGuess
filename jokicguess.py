import discord
from discord.ext import commands
from discord import app_commands
import os

intents = discord.Intents.default()
intents.reactions = True
intents.messages = True
intents.message_content = True  # To access message content

bot = commands.Bot(command_prefix='/', intents=intents)

# Questions and related data
questions = [
    {"question": "Real vs fake MVP clash. Who will score more points?", "options": ["A: Jokic", "B: Embiid"], "tie_breaker": False},
    {"question": "Who will win the game (Serbia +12.5)?", "options": ["A: Serbia(+12.5)", "B: USA(-12.5)"], "tie_breaker": False},
    {"question": "Real vs fake MVP clash. Who will have more rebounds?", "options": ["A: Jokic", "B: Embiid"], "tie_breaker": False},
    {"question": "Who will score more 3 pointers?", "options": ["A: Curry(-0.5)", "B: Bogdanovic(+0.5)"], "tie_breaker": False},
    {"question": "Heat duel, who will play more minutes?", "options": ["A: Bam", "B: Jovic"], "tie_breaker": False},
    {"question": "Point guard vs point forward? Who is the real GOAT, who will have more assists?", "options": ["A: LebronJames", "B: VasilijeMicic"], "tie_breaker": False},
    {"question": "Davis (+0.5) or Team Serbia? Who will have more blocks?", "options": ["A: AnthonyDavis(+0.5)", "B: Serbia"], "tie_breaker": False},
    {"question": "Who will be the top scorer in the game? (Tiebreaker less minutes played)", "options": ["A: Jokic", "B: Curry", "C: Lebron", "D: Others"], "tie_breaker": False},
    {"question": "How many points+rebounds+assists will Jokic have?", "options": [], "tie_breaker": True}  # Handle separately
]

user_guesses = {}
user_numeric_guesses = {}
message_to_question = {}
emoji_to_letter = {'🇦': 'A', '🇧': 'B', '🇨': 'C', '🇩': 'D'}

def find_question_for_message(msg_id):
    # Retrieve the question based on the message ID
    return message_to_question.get(msg_id, "Unknown Question")

class MyClient(discord.Client):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.tree = app_commands.CommandTree(self)

    async def on_ready(self):
        await self.tree.sync()
        print(f'Bot {self.user} is online!')

client = MyClient(intents=intents)

@client.tree.command(name="guess", description="Start the guessing game")
@app_commands.checks.has_permissions(administrator=True)
async def guess(interaction: discord.Interaction):
    guild_id = interaction.guild.id
    user_guesses[guild_id] = {}
    user_numeric_guesses[guild_id] = {}
    message_to_question.clear()  # Clear previous mappings
    
    await interaction.response.send_message("Starting the guessing game!")
    for question_data in questions:
        question = question_data["question"]
        options = question_data["options"]
        tie_breaker = question_data["tie_breaker"]
        
        if options:  # Handle multiple choice questions
            followup_message = f"{question}\n" + "\n".join(options)
            msg = await interaction.followup.send(followup_message, wait=True)
            message_to_question[msg.id] = question
            for option in options:
                emoji = list(emoji_to_letter.keys())[options.index(option)]
                await msg.add_reaction(emoji)
            user_guesses[guild_id][msg.id] = {}
        else:  # Handle numeric input question
            msg = await interaction.followup.send(question, wait=True)
            message_to_question[msg.id] = question

@client.tree.command(name="results", description="Enter the correct results (admin only)")
@app_commands.checks.has_permissions(administrator=True)
async def results(interaction: discord.Interaction, correct_answers: str, correct_tie_breaker: str):
    guild_id = interaction.guild.id
    score_board = {}

    correct_answers_list = correct_answers.split()
    print(f"Correct answers: {correct_answers_list}")

    for i, msg_id in enumerate(user_guesses[guild_id]):
        correct_answer = correct_answers_list[i]
        for user_id, guess in user_guesses[guild_id][msg_id].items():
            guess_letter = emoji_to_letter.get(guess)
            if guess_letter == correct_answer:
                if user_id not in score_board:
                    score_board[user_id] = 0
                score_board[user_id] += 1

    # Handle numeric question with a tie-breaker
    if guild_id in user_numeric_guesses:
        for msg_id in user_numeric_guesses[guild_id]:
            user_numeric_guesses_dict = user_numeric_guesses[guild_id][msg_id]
            tie_breaker_value = int(correct_tie_breaker)

            for user_id, guess_value in user_numeric_guesses_dict.items():
                if user_id not in score_board:
                    score_board[user_id] = 0
                # Tie-breaker logic
                score_board[user_id] -= abs(guess_value - tie_breaker_value) / 100  # Adjust based on how close the guess is

    sorted_scores = sorted(score_board.items(), key=lambda item: (item[1], -item[0]), reverse=True)

    results_message = "Results:\n"
    for user_id, score in sorted_scores:
        user = await client.fetch_user(user_id)
        results_message += f"{user.name}: {score} points\n"

    await interaction.response.send_message(results_message)
    print(f"Results message sent: {results_message}")

@results.error
async def results_error(interaction: discord.Interaction, error: app_commands.AppCommandError):
    if isinstance(error, app_commands.errors.MissingPermissions):
        await interaction.response.send_message("You do not have the required permissions to use this command.", ephemeral=True)
    else:
        await interaction.response.send_message("An error occurred while processing your command.", ephemeral=True)
    print(f"Error in results command: {error}")

@client.tree.command(name="predictions", description="Show all predictions made by all players")
@app_commands.checks.has_permissions(administrator=True)
async def predictions(interaction: discord.Interaction):
    guild_id = interaction.guild.id
    if guild_id not in user_guesses and guild_id not in user_numeric_guesses:
        await interaction.response.send_message("No predictions have been made yet.")
        return

    predictions_message = "Player Predictions:\n"

    # Gather multiple choice predictions
    for msg_id, guesses in user_guesses.get(guild_id, {}).items():
        question = find_question_for_message(msg_id)
        predictions_message += f"\n**{question}**\n"
        for user_id, emoji in guesses.items():
            user = await client.fetch_user(user_id)
            letter = emoji_to_letter.get(emoji, emoji)
            predictions_message += f"{user.name}: {letter}\n"

    # Gather numeric predictions
    if guild_id in user_numeric_guesses:
        predictions_message += "\n**How many minutes will Jokic play?**\n"
        for msg_id, guesses in user_numeric_guesses[guild_id].items():
            for user_id, guess in guesses.items():
                user = await client.fetch_user(user_id)
                predictions_message += f"{user.name}: {guess} minutes\n"

    # Send the predictions message
    await interaction.response.send_message(predictions_message)
    print(f"Predictions message sent: {predictions_message}")

@predictions.error
async def predictions_error(interaction: discord.Interaction, error: app_commands.AppCommandError):
    await interaction.response.send_message("An error occurred while processing your command.", ephemeral=True)
    print(f"Error in predictions command: {error}")

@client.event
async def on_reaction_add(reaction, user):
    if user.bot:
        return

    msg_id = reaction.message.id
    guild_id = reaction.message.guild.id

    if msg_id in user_guesses.get(guild_id, {}):
        user_guesses[guild_id][msg_id][user.id] = reaction.emoji
        try:
            await reaction.message.remove_reaction(reaction.emoji, user)
        except discord.Forbidden:
            print("The bot does not have permission to remove reactions. Please enable the 'Manage Messages' permission.")

@client.event
async def on_message(message):
    if message.author.bot:
        return

    guild_id = message.guild.id
    
    # Check if the message is related to numeric input
    if guild_id in user_numeric_guesses:
        try:
            minutes = int(message.content)
            if message.id not in user_numeric_guesses[guild_id]:
                user_numeric_guesses[guild_id][message.id] = {message.author.id: minutes}
            else:
                user_numeric_guesses[guild_id][message.id][message.author.id] = minutes
            await message.delete()
        except ValueError:
            await message.delete()  # Delete the message if it's not a valid number

# Read the token from secret.txt
token = os.getenv('DISCORD_TOKEN')
if not token: 
    with open('secret.txt', 'r') as file:
        token = file.read().strip()

client.run(token)
