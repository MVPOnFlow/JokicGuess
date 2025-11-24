"""Petting and reward commands for Discord bot."""

import discord
from discord.ext import commands
import datetime
import random

from utils.helpers import (
    prepare_query, is_admin, custom_reward, get_basic_pet_response
)
from config import PETTING_ALLOWED_CHANNEL_ID, DEFAULT_FREE_DAILY_PETS


def register_petting_commands(bot, conn, cursor, db_type):
    """Register petting and reward commands."""

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

        is_public = len(special_rewards_won) > 0

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
