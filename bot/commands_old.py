"""Discord bot command orchestration - imports and registers all command modules."""

from bot.contest_commands import register_contest_commands
from bot.petting_commands import register_petting_commands
from bot.fastbreak_commands import register_fastbreak_commands
from bot.swapfest_commands import register_swapfest_commands


def register_commands(bot, conn, cursor, db_type):
    """Register all Discord bot slash commands from separated modules."""
    register_contest_commands(bot, conn, cursor, db_type)
    register_petting_commands(bot, conn, cursor, db_type)
    register_fastbreak_commands(bot, conn, cursor, db_type)
    register_swapfest_commands(bot, conn, cursor, db_type)

    @bot.tree.command(name='start', description='Start a contest (Admin only)')
    @commands.has_permissions(administrator=True)
    async def start(interaction: discord.Interaction, name: str, start_time: int):
        channel = interaction.channel
        user = interaction.user

        cursor.execute(prepare_query('SELECT contest_name FROM contests WHERE channel_id = ?'), (channel.id,))
        existing_contest = cursor.fetchone()

        if existing_contest:
            await interaction.response.send_message(
                f"A contest '{existing_contest[0]}' is already active in this channel. Please finish it before starting a new one.",
                ephemeral=True
            )
            return

        start_contest(channel.id, name, start_time, user.id)

        await interaction.response.send_message(
            f"Contest '{name}' started in this channel! Game starts at <t:{start_time}:F>.", ephemeral=True)

    @bot.tree.command(name='predict', description='Predict stats total and game outcome')
    @app_commands.describe(
        stats='Total of 2xPts+3xReb+5xAs+7xStl+9xBlk for the player',
        outcome="Player's team wins or loses the game?",
    )
    async def predict(interaction: discord.Interaction, stats: str, outcome: Literal['Win', 'Loss']):
        user = interaction.user
        channel = interaction.channel

        cursor.execute(prepare_query('SELECT contest_name, start_time FROM contests WHERE channel_id = ?'), (channel.id,))
        contest = cursor.fetchone()

        if contest:
            contest_name, start_time = contest
            current_time = int(time.time())

            if current_time >= int(start_time):
                await interaction.response.send_message("Predictions are closed. The game has already started.",
                                                        ephemeral=True)
                return

            try:
                outcome_enum = Outcome[outcome.upper()]
            except KeyError:
                await interaction.response.send_message("Invalid outcome. Please use 'Win' or 'Loss'.", ephemeral=True)
                return

            save_prediction(user.id, contest_name, stats, outcome_enum, current_time)

            await interaction.response.send_message(
                f"Prediction saved for {user.name} in contest '{contest_name}'.", ephemeral=True
            )
        else:
            await interaction.response.send_message("No active contest in this channel. Please start a contest first.",
                                                    ephemeral=True)

    @bot.tree.command(name='remove_prediction', description='Remove a prediction')
    async def remove_prediction(interaction: discord.Interaction, stats: str, outcome: str):
        user = interaction.user
        channel = interaction.channel

        try:
            outcome_enum = Outcome[outcome.upper()]
        except KeyError:
            await interaction.response.send_message("Invalid outcome. Please use 'Win' or 'Loss'.", ephemeral=True)
            return

        cursor.execute(prepare_query('''
            DELETE FROM predictions
            WHERE user_id = ? AND contest_name = (SELECT contest_name FROM contests WHERE channel_id = ?)
            AND stats = ? AND outcome = ?
        '''), (user.id, channel.id, stats, outcome_enum.value))
        conn.commit()

        if cursor.rowcount > 0:
            await interaction.response.send_message("Prediction removed successfully.", ephemeral=True)
        else:
            predictions = get_user_predictions_for_contest(user.id, channel.id)
            if predictions:
                response = "No such entry. Here are your current predictions:\n"
                for contest_name, stats, outcome, timestamp in predictions:
                    response += f"Contest: {contest_name}, Stats: {stats}, Outcome: {outcome}\n"
            else:
                response = "No such entry. You have no predictions in this contest."

            await interaction.response.send_message(response, ephemeral=True)

    @bot.tree.command(name='predictions', description="List all predictions")
    async def predictions(interaction: discord.Interaction):
        user = interaction.user
        channel = interaction.channel

        query = 'SELECT start_time, creator_id FROM contests WHERE channel_id = ?'
        query = prepare_query(query)
        cursor.execute(query, (channel.id,))
        contest = cursor.fetchone()

        if contest:
            start_time, creator_id = contest

            if int(time.time()) < int(start_time) and user.id != creator_id:
                await interaction.response.send_message("Predictions are hidden until the game starts.", ephemeral=True)
                return

            predictions = get_predictions_for_contest(channel.id)

            if predictions:
                response = ""
                for user_id, stats, outcome, timestamp in predictions:
                    query = 'SELECT username FROM user_mapping WHERE user_id = ?'
                    query = prepare_query(query)
                    cursor.execute(query, (user_id,))
                    result = cursor.fetchone()

                    if result:
                        username = result[0]
                    else:
                        try:
                            user_obj = await bot.fetch_user(user_id)
                            username = user_obj.name
                            if db_type == 'postgresql':
                                query = '''INSERT INTO user_mapping (user_id, username) 
                                           VALUES (%s, %s) 
                                           ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username'''
                            else:
                                query = 'INSERT OR REPLACE INTO user_mapping (user_id, username) VALUES (?, ?)'

                            query = prepare_query(query)
                            cursor.execute(query, (user_id, username))
                            conn.commit()
                        except Exception as e:
                            username = f"User {user_id}"

                    response += f"{username}: Stats: {stats}, Outcome: {outcome}\n"

                if len(response) > 2000:
                    csv_output = await create_predictions_csv(predictions)
                    csv_filename = f"predictions_{channel.id}.csv"
                    discord_file = discord.File(fp=csv_output, filename=csv_filename)
                    await interaction.response.send_message(
                        content="The predictions list is too large. Here is the CSV file.", file=discord_file,
                        ephemeral=True)
                else:
                    await interaction.response.send_message(response, ephemeral=True)
            else:
                await interaction.response.send_message("No predictions have been made for this contest.", ephemeral=True)
        else:
            await interaction.response.send_message("No active contest in this channel.", ephemeral=True)

    @bot.tree.command(name='my_predictions', description='List my predictions')
    async def my_predictions(interaction: discord.Interaction):
        user = interaction.user
        channel = interaction.channel

        predictions = get_user_predictions_for_contest(user.id, channel.id)

        if predictions:
            embed = discord.Embed(title=f"{user.name}'s Predictions in Current Contest", color=discord.Color.blue())
            for contest_name, stats, outcome, timestamp in predictions:
                embed.add_field(name=contest_name, value=f"Stats: {stats}, Outcome: {outcome}", inline=False)
        else:
            embed = discord.Embed(title="No Predictions",
                                  description="You haven't made any predictions for the current contest.",
                                  color=discord.Color.red())

        await interaction.response.send_message(embed=embed, ephemeral=True)

    @bot.tree.command(name='total_predictions', description='Show number of predictions')
    async def total_predictions(interaction: discord.Interaction):
        channel = interaction.channel
        total = count_total_predictions(channel.id)
        await interaction.response.send_message(f"Total predictions made: {total}", ephemeral=True)

    @bot.tree.command(name='winner', description='Declare winner (Admin only)')
    async def winner(interaction: discord.Interaction, stats: int, outcome: str):
        channel = interaction.channel
        user = interaction.user

        if outcome not in ['Win', 'Loss']:
            await interaction.response.send_message("Invalid outcome. Outcome must be 'Win' or 'Loss'.", ephemeral=True)
            return

        query = 'SELECT start_time, creator_id FROM contests WHERE channel_id = ?'
        query = prepare_query(query)
        cursor.execute(query, (channel.id,))
        contest = cursor.fetchone()

        if not contest:
            await interaction.response.send_message("No active contest found for this channel.", ephemeral=True)
            return

        start_time, creator_id = contest

        if user.id != creator_id:
            await interaction.response.send_message("Only the contest creator can declare the winner.", ephemeral=True)
            return

        predictions = get_predictions_for_contest(channel.id)

        if not predictions:
            await interaction.response.send_message("No predictions found for this contest.", ephemeral=True)
            return

        valid_predictions = [p for p in predictions if p[2] == outcome]

        if not valid_predictions:
            await interaction.response.send_message("No predictions with the correct outcome.", ephemeral=True)
            return

        smallest_diff = float('inf')
        winners = []

        for user_id, pred_stats, pred_outcome, timestamp in valid_predictions:
            diff = abs(int(pred_stats) - stats)
            if diff < smallest_diff:
                smallest_diff = diff
                winners = [(user_id, pred_stats, pred_outcome)]
            elif diff == smallest_diff:
                winners.append((user_id, pred_stats, pred_outcome))

        if winners:
            response = f"🎉 **We have a winner** for the contest in **{channel.name}**! 🎉\n"
            response += f"🏆 Congratulations to the following amazing predictor(s):\n\n"

            for winner in winners:
                user_id, winner_stats, winner_outcome = winner

                query = 'SELECT username FROM user_mapping WHERE user_id = ?'
                query = prepare_query(query)
                cursor.execute(query, (user_id,))
                result = cursor.fetchone()

                if result:
                    username = result[0]
                else:
                    try:
                        user_obj = await bot.fetch_user(user_id)
                        username = user_obj.name
                        if db_type == 'postgresql':
                            query = '''INSERT INTO user_mapping (user_id, username) 
                                       VALUES (%s, %s) 
                                       ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username'''
                        else:
                            query = 'INSERT OR REPLACE INTO user_mapping (user_id, username) VALUES (?, ?)'

                        query = prepare_query(query)
                        cursor.execute(query, (user_id, username))
                        conn.commit()
                    except Exception as e:
                        username = f"User {user_id}"

                response += f"**{username}** 🏅 - Predicted Stats: `{winner_stats}`, Outcome: `{winner_outcome}`\n"

            response += "\n🔥 Great job everyone! Let's go for the next round soon! 🔥"
        else:
            response = "No winners found."

        await interaction.response.send_message(response)

    @bot.tree.command(name="list_active_fastbreak_runs", description="Admin only: Dump all active FastBreak runs as JSON file")
    @app_commands.checks.has_permissions(administrator=True)
    async def list_active_fastbreak_runs(interaction: discord.Interaction):
        await interaction.response.defer()

        if not is_admin(interaction):
            await interaction.response.send_message(
                "You need admin permissions to run this command.",
                ephemeral=True
            )
            return
        try:
            runs = extract_fastbreak_runs()
            json_data = json.dumps(runs, indent=2)
            buffer = io.BytesIO(json_data.encode('utf-8'))
            buffer.seek(0)
            discord_file = discord.File(fp=buffer, filename="fastbreak_runs.json")

            await interaction.followup.send(
                content="Here is the full FastBreak runs JSON:",
                file=discord_file,
                ephemeral=True
            )

        except Exception as e:
            await interaction.followup.send(f"Error: {e}", ephemeral=True)

    @bot.tree.command(
        name="create_fastbreak_contest",
        description="Admin only: Create a new FastBreak contest."
    )
    @commands.has_permissions(administrator=True)
    async def create_fastbreak_contest(
        interaction: discord.Interaction,
        fastbreak_id: str,
        display_name: str,
        lock_timestamp: str,
        buy_in_currency: str = 'MVP',
        buy_in_amount: float = 5.0
    ):
        if not is_admin(interaction):
            await interaction.response.send_message(
                "You need admin permissions to run this command.",
                ephemeral=True
            )
            return

        try:
            cursor.execute(prepare_query('''
                INSERT INTO fastbreakContests (
                    fastbreak_id, display_name, lock_timestamp, buy_in_currency, buy_in_amount
                ) VALUES (?, ?, ?, ?, ?)
            '''), (
                fastbreak_id,
                display_name,
                lock_timestamp,
                buy_in_currency,
                buy_in_amount
            ))
            conn.commit()

            await interaction.response.send_message(
                f"✅ Contest created!\n"
                f"FastBreak ID: **{fastbreak_id}**\n"
                f"Display name: **{display_name}**\n"
                f"Lock Timestamp: **{lock_timestamp}**\n"
                f"Buy-In: **{buy_in_amount} {buy_in_currency}**",
                ephemeral=True
            )

        except Exception as e:
            print(f"Error creating contest: {e}")
            await interaction.response.send_message(
                "❌ Failed to create contest. Please try again.",
                ephemeral=True
            )

    @bot.tree.command(
        name="close_fastbreak_contest",
        description="Admin only: Close a FastBreak contest."
    )
    @commands.has_permissions(administrator=True)
    async def close_fastbreak_contest(
            interaction: discord.Interaction,
            contest_id: int
    ):
        if not is_admin(interaction):
            await interaction.response.send_message(
                "You need admin permissions to run this command.",
                ephemeral=True
            )
            return

        try:
            cursor.execute(prepare_query('''
                UPDATE fastbreakContests
                SET status = 'CLOSED'
                WHERE id = ?
            '''), (contest_id,))
            conn.commit()

            await interaction.response.send_message(
                f"✅ Contest {contest_id} has been closed.",
                ephemeral=True
            )
        except Exception as e:
            print(f"Error closing contest: {e}")
            await interaction.response.send_message(
                "❌ Failed to close contest. Please try again.",
                ephemeral=True
            )

    @bot.tree.command(name="pet", description="Perform a daily pet and earn random $MVP rewards!")
    async def pet(interaction: discord.Interaction):
        if interaction.channel_id != PETTING_ALLOWED_CHANNEL_ID:
            return await interaction.response.send_message(
                "You can only pet your horse in the petting zoo.", ephemeral=True
            )

        user_id = interaction.user.id
        today = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d")

        def check_special_reward():
            cursor.execute(prepare_query("SELECT id, name, probability, amount FROM special_rewards"))
            rewards = cursor.fetchall()

            for reward_id, name, probability, amount in rewards:
                if random.random() <= probability:
                    if amount > 0:
                        cursor.execute(prepare_query(
                            f"UPDATE special_rewards SET amount = {amount - 1} WHERE id = ?"
                        ), (reward_id,))
                        conn.commit()
                        if amount - 1 == 0:
                            cursor.execute(prepare_query(
                                "DELETE FROM special_rewards WHERE name = ?"
                            ), (name,))
                            conn.commit()
                        return name
            return None

        cursor.execute(prepare_query(
            "SELECT balance, daily_pets_remaining, last_pet_date FROM user_rewards WHERE user_id = ?"
        ), (user_id,))
        user_data = cursor.fetchone()

        if not user_data:
            cursor.execute(prepare_query(
                "INSERT INTO user_rewards (user_id, balance, daily_pets_remaining, last_pet_date) VALUES (?, ?, ?, ?)"
            ), (user_id, 0, 0, None))
            conn.commit()
            user_data = (0, 0, None)

        balance, daily_pets_remaining, last_pet_date = user_data

        if last_pet_date != today:
            daily_pets_remaining += DEFAULT_FREE_DAILY_PETS

        if daily_pets_remaining <= 0:
            await interaction.response.send_message(
                "Hold your horses! You've used all your pets for today! Try again tomorrow.", ephemeral=True
            )
            return

        reward = custom_reward()
        special_reward = check_special_reward()
        special_reward_message = ""
        new_daily_pets_remaining = daily_pets_remaining - 1
        
        if special_reward:
            new_balance = balance
            special_reward_message = f"🎉 Congratulations <@{interaction.user.id}>! You won a special reward **{special_reward}**! 🎉"
            await interaction.response.send_message(
                f"{special_reward_message}\n"
                f"<@1261935277753241653> will follow up with the reward shortly\n"
                f"Daily pets remaining: **{new_daily_pets_remaining}**.\n",
                ephemeral=False
            )
        else:
            new_balance = balance + reward
            await interaction.response.send_message(
                get_basic_pet_response(reward) +
                f"\nYour new balance is **{new_balance} $MVP**.\n"
                f"{special_reward_message}\n"
                f"Daily pets remaining: **{new_daily_pets_remaining}**.\n",
                ephemeral=True
            )

        cursor.execute(prepare_query(
            "UPDATE user_rewards SET balance = ?, daily_pets_remaining = ?, last_pet_date = ? WHERE user_id = ?"
        ), (new_balance, new_daily_pets_remaining, today, user_id))
        conn.commit()

    @bot.tree.command(name="pet_all", description="Use all available pets at once and earn rewards!")
    async def pet_all(interaction: discord.Interaction):
        if interaction.channel_id != PETTING_ALLOWED_CHANNEL_ID:
            return await interaction.response.send_message(
                "You can only pet your horse in the petting zoo.", ephemeral=True
            )

        user_id = interaction.user.id
        today = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d")

        def check_special_reward():
            cursor.execute(prepare_query("SELECT id, name, probability, amount FROM special_rewards"))
            rewards = cursor.fetchall()

            for reward_id, name, probability, amount in rewards:
                if random.random() <= probability:
                    if amount > 0:
                        cursor.execute(prepare_query(
                            f"UPDATE special_rewards SET amount = {amount - 1} WHERE id = ?"
                        ), (reward_id,))
                        conn.commit()
                        if amount - 1 == 0:
                            cursor.execute(prepare_query(
                                "DELETE FROM special_rewards WHERE name = ?"
                            ), (name,))
                            conn.commit()
                        return name
            return None

        cursor.execute(prepare_query(
            "SELECT balance, daily_pets_remaining, last_pet_date FROM user_rewards WHERE user_id = ?"
        ), (user_id,))
        user_data = cursor.fetchone()

        if not user_data:
            cursor.execute(prepare_query(
                "INSERT INTO user_rewards (user_id, balance, daily_pets_remaining, last_pet_date) VALUES (?, ?, ?, ?)"
            ), (user_id, 0, 0, None))
            conn.commit()
            user_data = (0, 0, None)

        balance, daily_pets_remaining, last_pet_date = user_data

        if last_pet_date != today:
            daily_pets_remaining += DEFAULT_FREE_DAILY_PETS

        if daily_pets_remaining <= 0:
            await interaction.response.send_message(
                "Hold your horses! You've used all your pets for today! Try again tomorrow.", ephemeral=True
            )
            return

        total_mvp_reward = 0
        special_rewards_won = []
        pets_used = daily_pets_remaining

        for _ in range(daily_pets_remaining):
            special_reward = check_special_reward()
            if special_reward:
                special_rewards_won.append(special_reward)
            else:
                reward = custom_reward()
                total_mvp_reward += reward

        new_balance = balance + total_mvp_reward
        new_daily_pets_remaining = 0

        cursor.execute(prepare_query(
            "UPDATE user_rewards SET balance = ?, daily_pets_remaining = ?, last_pet_date = ? WHERE user_id = ?"
        ), (new_balance, new_daily_pets_remaining, today, user_id))
        conn.commit()

        response_parts = [f"🐴 You used **{pets_used}** pets! 🐴\n"]

        if special_rewards_won:
            response_parts.append("🎉 **Special Rewards Won:** 🎉")
            for reward in special_rewards_won:
                response_parts.append(f"- **{reward}**")
            response_parts.append(f"<@1261935277753241653> will follow up with the rewards shortly.\n")

        if total_mvp_reward > 0:
            response_parts.append(get_basic_pet_response(total_mvp_reward))
            response_parts.append(f"Your new balance is **{new_balance} $MVP**.")

        response_parts.append(f"\nDaily pets remaining: **{new_daily_pets_remaining}**.")

        is_public = True

        await interaction.response.send_message(
            "\n".join(response_parts),
            ephemeral=not is_public
        )

    @bot.tree.command(name="my_rewards", description="View your unclaimed $MVP rewards.")
    async def my_rewards(interaction: discord.Interaction):
        if interaction.channel_id != PETTING_ALLOWED_CHANNEL_ID:
            return await interaction.response.send_message(
                "You can check your rewards in the petting zoo.", ephemeral=True
            )

        user_id = interaction.user.id

        cursor.execute(prepare_query("SELECT balance FROM user_rewards WHERE user_id = ?"), (user_id,))
        user_data = cursor.fetchone()

        if not user_data or user_data[0] == 0:
            await interaction.response.send_message(
                "You have no unclaimed rewards. Start petting to earn rewards!", ephemeral=True
            )
        else:
            await interaction.response.send_message(
                f"Your unclaimed rewards: **{user_data[0]:.2f} $MVP**", ephemeral=True
            )

    @bot.tree.command(name="claim", description="Claim your accumulated $MVP rewards.")
    async def claim(interaction: discord.Interaction):
        if interaction.channel_id != PETTING_ALLOWED_CHANNEL_ID:
            return await interaction.response.send_message(
                "You can claim your rewards in the petting zoo in the petting zoo.", ephemeral=True
            )

        user_id = interaction.user.id

        cursor.execute(prepare_query("SELECT balance FROM user_rewards WHERE user_id = ?"), (user_id,))
        user_data = cursor.fetchone()

        if not user_data or user_data[0] < 1:
            await interaction.response.send_message(
                "You need at least 1 $MVP to claim.", ephemeral=True
            )
            return

        balance = user_data[0]
        cursor.execute(prepare_query("UPDATE user_rewards SET balance = 0 WHERE user_id = ?"), (user_id,))
        conn.commit()

        await interaction.response.send_message(
            f"{interaction.user.mention} has claimed **{balance:.2f} $MVP**! 🐴\n<@1261935277753241653>, please process the claim."
        )

    @bot.tree.command(name="add_pets", description="Admin command to grant extra pets to a user.")
    @commands.has_permissions(administrator=True)
    async def add_pets(interaction: discord.Interaction, user: discord.Member, pets: int):
        if not is_admin(interaction):
            await interaction.response.send_message("You need admin permissions to run this command.", ephemeral=True)
            return
        if pets <= 0:
            await interaction.response.send_message("Number of pets must be greater than 0.", ephemeral=True)
            return

        user_id = user.id

        cursor.execute(prepare_query(
            "SELECT daily_pets_remaining FROM user_rewards WHERE user_id = ?"
        ), (user_id,))
        user_data = cursor.fetchone()

        if user_data:
            new_pets_remaining = user_data[0] + pets
            cursor.execute(prepare_query(
                "UPDATE user_rewards SET daily_pets_remaining = ? WHERE user_id = ?"
            ), (new_pets_remaining, user_id))
        else:
            new_pets_remaining = pets + 1
            cursor.execute(prepare_query(
                "INSERT INTO user_rewards (user_id, balance, daily_pets_remaining, last_pet_date) VALUES (?, ?, ?, ?)"
            ), (user_id, 0, pets, None))

        conn.commit()

        await interaction.response.send_message(
            f"Added {pets} extra pets for {user.mention}. They now have {new_pets_remaining} pets remaining.",
            ephemeral=False
        )

    @bot.tree.command(name="petting_stats", description="View petting statistics (Admin only)")
    @commands.has_permissions(administrator=True)
    async def petting_stats(interaction: discord.Interaction):
        if not is_admin(interaction):
            await interaction.response.send_message("You need admin permissions to run this command.", ephemeral=True)
            return
        
        today = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d")

        cursor.execute(prepare_query(
            "SELECT COUNT(DISTINCT user_id) FROM user_rewards WHERE last_pet_date = ?"
        ), (today,))
        daily_active_users = cursor.fetchone()[0]

        cursor.execute(prepare_query(
            "SELECT SUM(balance) FROM user_rewards"
        ))
        total_unclaimed_rewards = cursor.fetchone()[0] or 0

        cursor.execute(prepare_query(
            "SELECT user_id, balance FROM user_rewards ORDER BY balance DESC LIMIT 10"
        ))
        top_users = cursor.fetchall()

        top_users_text = "\n".join([f"<@{user_id}> : {balance} $MVP" for user_id, balance in top_users])

        stats_message = (
            f"📊 **Petting Stats** 📊\n"
            f"**Daily active petting users today:** {daily_active_users}\n"
            f"**Total active unclaimed rewards:** {total_unclaimed_rewards} $MVP\n\n"
            f"🏆 **Top 10 User Balances:**\n{top_users_text if top_users else 'No users yet.'}"
        )

        await interaction.response.send_message(stats_message, ephemeral=True)

    @bot.tree.command(name="add_petting_reward", description="(Admin) Add a special petting reward.")
    @commands.has_permissions(administrator=True)
    async def add_petting_reward(interaction: discord.Interaction, name: str, probability: float, amount: int):
        if not is_admin(interaction):
            await interaction.response.send_message("You need admin permissions to run this command.", ephemeral=True)
            return
        if probability <= 0 or probability > 1:
            await interaction.response.send_message("Probability must be between 0 and 1.", ephemeral=True)
            return
        if amount <= 0:
            await interaction.response.send_message("Amount must be greater than 0.", ephemeral=True)
            return

        cursor.execute(prepare_query(
            "INSERT INTO special_rewards (name, probability, amount) VALUES (?, ?, ?)"
        ), (name, probability, amount))
        conn.commit()

        await interaction.response.send_message(
            f"✅ Added special reward **{name}** with {amount} available and {probability * 100}% hit chance per pet.",
            ephemeral=True
        )

    @bot.tree.command(name="list_petting_rewards", description="(Admin) List all active special petting rewards.")
    @commands.has_permissions(administrator=True)
    async def list_petting_rewards(interaction: discord.Interaction):
        if not is_admin(interaction):
            await interaction.response.send_message("You need admin permissions to run this command.", ephemeral=True)
            return
        
        cursor.execute(prepare_query("SELECT name, probability, amount FROM special_rewards"))
        rewards = cursor.fetchall()

        if not rewards:
            await interaction.response.send_message("There are no active special petting rewards.", ephemeral=True)
            return

        reward_list = "\n".join([f"**{name}** - {probability * 100:.3f}% chance - {amount} left" for name, probability, amount in rewards])

        await interaction.response.send_message(
            f"📜 **Active Special Petting Rewards:**\n{reward_list}",
            ephemeral=True
        )

    @bot.tree.command(
        name="gift_leaderboard",
        description="Show Swapfest leaderboard by total gifted points in event period"
    )
    async def gift_leaderboard(interaction: discord.Interaction):
        start_time = SWAPFEST_START_TIME
        end_time = SWAPFEST_END_TIME
        boost1_cutoff = SWAPFEST_BOOST1_CUTOFF
        boost2_cutoff = SWAPFEST_BOOST2_CUTOFF

        cursor.execute(prepare_query('''
            SELECT
                from_address,
                SUM(points * CASE
                    WHEN timestamp < ? THEN 1.4
                    WHEN timestamp < ? THEN 1.2
                    ELSE 1.0
                END) AS total_points
            FROM gifts
            WHERE timestamp BETWEEN ? AND ?
            GROUP BY from_address
            ORDER BY total_points DESC
            LIMIT 20
        '''), (boost1_cutoff, boost2_cutoff, start_time, end_time))
        rows = cursor.fetchall()

        if not rows:
            await interaction.response.send_message(
                "No gift records found in the event period.",
                ephemeral=True
            )
            return

        leaderboard_lines = ["🎁 **Swapfest Gift Leaderboard** 🎁"]
        leaderboard_lines.append(
            f"_Between {start_time} UTC and {end_time} UTC_"
            f"\n_1.4× before {boost1_cutoff} • 1.2× before {boost2_cutoff}_\n"
        )
        for i, (from_address, total_points) in enumerate(rows, start=1):
            username = map_wallet_to_username(from_address)
            leaderboard_lines.append(f"{i}. `{username}` : **{total_points:.2f} points**")

        message = "\n".join(leaderboard_lines)
        await interaction.response.send_message(message, ephemeral=True)

    @bot.tree.command(name="swapfest_latest_block", description="Check the last processed blockchain block scraping swapfest gifts (Admin only)")
    @commands.has_permissions(administrator=True)
    async def latest_block(interaction: discord.Interaction):
        if not is_admin(interaction):
            await interaction.response.send_message(
                "You need admin permissions to run this command.",
                ephemeral=True
            )
            return

        last_block = get_last_processed_block()

        if last_block is None:
            await interaction.response.send_message(
                "⚠️ No processed block found.",
                ephemeral=True
            )
            return

        await interaction.response.send_message(
            f"🧱 **Last processed block:** {last_block}",
            ephemeral=True
        )

    @bot.tree.command(
        name="add_gift_swapfest",
        description="(Admin only) Manually add a swapfest gift to the database"
    )
    @commands.has_permissions(administrator=True)
    async def add_gift(
        interaction: discord.Interaction,
        txn_id: str,
        moment_id: int,
        from_address: str,
        points: int,
        timestamp: str
    ):
        if not is_admin(interaction):
            await interaction.response.send_message(
                "You need admin permissions to run this command.",
                ephemeral=True
            )
            return

        try:
            save_gift(txn_id, moment_id, from_address, points, timestamp)

            await interaction.response.send_message(
                f"✅ Gift added:\n- txn_id: {txn_id}\n- moment_id: {moment_id}\n- from: {from_address}\n- points: {points}\n- timestamp: {timestamp}",
                ephemeral=True
            )

        except Exception as e:
            await interaction.response.send_message(
                f"❌ Failed to add gift: {e}",
                ephemeral=True
            )

    @bot.tree.command(
        name="latest_gifts_csv",
        description="(Admin only) List the latest gifts in CSV format (optionally filter by username)"
    )
    @commands.has_permissions(administrator=True)
    async def latest_gifts_csv(
        interaction: discord.Interaction,
        from_address: str | None = None
    ):
        if not is_admin(interaction):
            await interaction.response.send_message(
                "You need admin permissions to run this command.",
                ephemeral=True
            )
            return

        if from_address:
            query = prepare_query('''
                SELECT txn_id, moment_id, from_address, points, timestamp
                FROM gifts
                WHERE from_address = ?
                ORDER BY timestamp DESC
                LIMIT 10
            ''')
            cursor.execute(query, (from_address,))
        else:
            query = prepare_query('''
                SELECT txn_id, moment_id, from_address, points, timestamp
                FROM gifts
                ORDER BY timestamp DESC
                LIMIT 10
            ''')
            cursor.execute(query)

        rows = cursor.fetchall()

        if not rows:
            await interaction.response.send_message(
                "No gifts found in the database.",
                ephemeral=True
            )
            return

        csv_lines = ["txn_id,moment_id,from_address,points,timestamp"]

        for txn_id, moment_id, from_address, points, timestamp in rows:
            display_name = map_wallet_to_username(from_address)
            csv_line = f"{txn_id},{moment_id},{display_name},{points},{timestamp}"
            csv_lines.append(csv_line)

        csv_text = "\n".join(csv_lines)
        message_content = f"```csv\n{csv_text}\n```"

        await interaction.response.send_message(message_content, ephemeral=True)

    @bot.tree.command(
        name="swapfest_refresh_points",
        description="(Admin only) Re-scan gifts with 0 points and refresh their scoring"
    )
    @commands.has_permissions(administrator=True)
    async def swapfest_refresh_points(interaction: discord.Interaction):
        if not is_admin(interaction):
            await interaction.response.send_message(
                "You need admin permissions to run this command.",
                ephemeral=True
            )
            return

        await interaction.response.send_message(
            "🔄 Refreshing points for gifts with 0 points. This may take a while...", 
            ephemeral=True
        )

        import swapfest

        cursor.execute(prepare_query('''
            SELECT txn_id, moment_id, from_address
            FROM gifts
            WHERE COALESCE(points, 0) = 0
        '''))
        rows = cursor.fetchall()

        if not rows:
            await interaction.followup.send(
                "✅ No gifts with 0 points found.",
                ephemeral=True
            )
            return

        updated_count = 0

        for txn_id, moment_id, from_address in rows:
            await interaction.followup.send(
                f"✅ Refreshing points for {moment_id}.",
                ephemeral=True
            )
            new_points = await swapfest.get_moment_points(FLOW_ACCOUNT, int(moment_id))
            if new_points > 0:
                await interaction.followup.send(
                    f"✅ Refreshing points for {moment_id}: {new_points}.",
                    ephemeral=True
                )
                cursor.execute(prepare_query('''
                    UPDATE gifts
                    SET points = ?
                    WHERE txn_id = ?
                '''), (new_points, txn_id))
                updated_count += 1
                conn.commit()

        await interaction.followup.send(
            f"✅ Refreshed points for {updated_count} gifts.",
            ephemeral=True
        )

    @bot.tree.command(name="pull_fastbreak_horse_stats", description="Admin only: Pull and store new FastBreaks and their rankings.")
    @app_commands.checks.has_permissions(administrator=True)
    async def pull_fastbreak_horse_stats(interaction: discord.Interaction, fb_id: str):
        await interaction.response.defer(ephemeral=True)

        if not is_admin(interaction):
            await interaction.followup.send("You need admin permissions to run this command.", ephemeral=True)
            return

        new_fastbreaks = []
        new_rankings_count = 0

        runs = extract_fastbreak_runs()

        for run in runs[:7]:
            if not run['fastBreaks'] or run['runName'].endswith('Pro'):
                continue
            run_name = run.get('runName', '')
            for fb in run.get('fastBreaks', []):
                if not fb or fb.get('status') != 'FAST_BREAK_FINISHED':
                    continue

                if fb_id == fb.get('id'):
                    game_date = fb.get('gameDate')
                    status = fb.get('status')

                    cursor.execute(prepare_query('SELECT 1 FROM fastbreaks WHERE id = ?'), (fb_id,))

                    cursor.execute(prepare_query('''
                        INSERT INTO fastbreaks (id, game_date, run_name, status)
                        VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING
                    '''), (fb_id, game_date, run_name, status))
                    conn.commit()
                    new_fastbreaks.append({
                        'id': fb_id,
                        'game_date': game_date,
                        'run_name': run_name
                    })

                    new_rankings_count += len(pull_rankings_for_fb(fb_id))
                    print(f"✅ FastBreak {fb_id} stored with {new_rankings_count} rankings.")

        cursor.execute("REFRESH MATERIALIZED VIEW user_rankings_summary")
        conn.commit()

        await interaction.followup.send(
            f"✅ Pulled {len(new_fastbreaks)} new finished FastBreaks and {new_rankings_count} total rankings.",
            ephemeral=True
        )
