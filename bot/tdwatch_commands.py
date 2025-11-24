"""TD Watch commands for Discord bot - Manage Jokic's triple-double milestone tracking.

EXAMPLE COMMANDS:
================

1. Add a game to the schedule:
   /td_add_game game_date:2025-12-25 opponent:Lakers is_home:True location:Ball Arena
   /td_add_game game_date:2025-12-28 opponent:Celtics is_home:False location:TD Garden

2. Update game with Jokic's stats (auto-detects triple-doubles):
   /td_update_game game_date:2025-12-25 opponent:Lakers points:29 rebounds:13 assists:11
   /td_update_game game_date:2025-12-20 opponent:Warriors points:18 rebounds:9 assists:7

3. Add prize packs to the pool:
   /td_add_pack name:Series 4 Base Pack quantity:5 series:Series 4 description:Standard pack
   /td_add_pack name:Rising Stars Pack quantity:2 series:Series 3

4. Remove prize packs from the pool:
   /td_remove_pack name:Series 4 Base Pack quantity:1
   /td_remove_pack name:Rising Stars Pack quantity:2

5. List available prize packs (anyone can use):
   /td_list_packs

6. List recent/upcoming games (anyone can use):
   /td_list_games limit:15

NOTES:
- Date format must be YYYY-MM-DD (e.g., 2025-12-25)
- Triple-double = 10+ in at least 3 categories (points, rebounds, assists)
- Admin commands require Discord administrator permissions
- Pack names must match exactly when removing packs
"""

import discord
from discord.ext import commands
from discord import app_commands
from typing import Optional

from utils.helpers import prepare_query, is_admin


def register_tdwatch_commands(bot, conn, cursor, db_type):
    """Register TD Watch game and prize pack management commands."""

    @bot.tree.command(
        name="td_add_game",
        description="Admin only: Add a Nuggets game to the TD Watch schedule"
    )
    @commands.has_permissions(administrator=True)
    async def td_add_game(
        interaction: discord.Interaction,
        game_date: str,
        opponent: str,
        is_home: bool,
        location: Optional[str] = None
    ):
        """Add a game to the Nuggets schedule.
        
        Args:
            game_date: Date in YYYY-MM-DD format (e.g., 2025-12-25)
            opponent: Opponent team name (e.g., "Lakers", "Celtics")
            is_home: True if home game, False if away
            location: Arena name (e.g., "Ball Arena", "TD Garden")
        """
        if not is_admin(interaction):
            await interaction.response.send_message(
                "You need admin permissions to run this command.",
                ephemeral=True
            )
            return

        try:
            # Validate date format
            from datetime import datetime
            try:
                datetime.strptime(game_date, '%Y-%m-%d')
            except ValueError:
                await interaction.response.send_message(
                    "❌ Invalid date format. Use YYYY-MM-DD (e.g., 2025-12-25)",
                    ephemeral=True
                )
                return

            # Check if game already exists
            cursor.execute(prepare_query('''
                SELECT id FROM nuggets_schedule
                WHERE game_date = ? AND opponent = ?
            '''), (game_date, opponent))
            
            if cursor.fetchone():
                await interaction.response.send_message(
                    f"❌ A game against {opponent} on {game_date} already exists.",
                    ephemeral=True
                )
                return

            # Insert the game
            cursor.execute(prepare_query('''
                INSERT INTO nuggets_schedule 
                (game_date, opponent, is_home, location, played, triple_double)
                VALUES (?, ?, ?, ?, 0, 0)
            '''), (game_date, opponent, 1 if is_home else 0, location or ''))
            
            conn.commit()

            home_away = "HOME" if is_home else "AWAY"
            location_text = f" at {location}" if location else ""
            
            await interaction.response.send_message(
                f"✅ Game added!\n"
                f"📅 Date: **{game_date}**\n"
                f"🏀 Opponent: **{opponent}** ({home_away}){location_text}\n"
                f"Status: Not yet played",
                ephemeral=True
            )

        except Exception as e:
            print(f"Error adding game: {e}")
            await interaction.response.send_message(
                "❌ Failed to add game. Please try again.",
                ephemeral=True
            )

    @bot.tree.command(
        name="td_update_game",
        description="Admin only: Update game result and Jokic's stats"
    )
    @commands.has_permissions(administrator=True)
    async def td_update_game(
        interaction: discord.Interaction,
        game_date: str,
        opponent: str,
        points: int,
        rebounds: int,
        assists: int
    ):
        """Mark a game as played and record Jokic's stats.
        
        Args:
            game_date: Date in YYYY-MM-DD format
            opponent: Opponent team name
            points: Jokic's points
            rebounds: Jokic's rebounds
            assists: Jokic's assists
        """
        if not is_admin(interaction):
            await interaction.response.send_message(
                "You need admin permissions to run this command.",
                ephemeral=True
            )
            return

        try:
            # Find the game
            cursor.execute(prepare_query('''
                SELECT id, played FROM nuggets_schedule
                WHERE game_date = ? AND opponent = ?
            '''), (game_date, opponent))
            
            game = cursor.fetchone()
            if not game:
                await interaction.response.send_message(
                    f"❌ No game found against {opponent} on {game_date}.\n"
                    f"Use `/td_add_game` to add it first.",
                    ephemeral=True
                )
                return

            game_id, already_played = game

            # Check for triple-double (10+ in 3 categories)
            categories = [points >= 10, rebounds >= 10, assists >= 10]
            is_triple_double = sum(categories) >= 3

            # Update the game
            cursor.execute(prepare_query('''
                UPDATE nuggets_schedule
                SET played = 1,
                    triple_double = ?,
                    points = ?,
                    rebounds = ?,
                    assists = ?
                WHERE id = ?
            '''), (1 if is_triple_double else 0, points, rebounds, assists, game_id))
            
            conn.commit()

            # Build response
            td_emoji = "🎉" if is_triple_double else "📊"
            td_text = "**TRIPLE-DOUBLE!**" if is_triple_double else "No triple-double"
            
            response = (
                f"{td_emoji} Game updated!\n"
                f"📅 **{game_date}** vs **{opponent}**\n"
                f"📈 Stats: **{points}** pts, **{rebounds}** reb, **{assists}** ast\n"
                f"🏆 {td_text}"
            )

            if is_triple_double:
                response += "\n\n💡 **Reminder:** Run raffle commands to award prize packs!"

            await interaction.response.send_message(response, ephemeral=True)

        except Exception as e:
            print(f"Error updating game: {e}")
            await interaction.response.send_message(
                "❌ Failed to update game. Please try again.",
                ephemeral=True
            )

    @bot.tree.command(
        name="td_add_pack",
        description="Admin only: Add prize packs to the TD Watch pool"
    )
    @commands.has_permissions(administrator=True)
    async def td_add_pack(
        interaction: discord.Interaction,
        name: str,
        quantity: int,
        series: Optional[str] = None,
        description: Optional[str] = None
    ):
        """Add prize packs to the raffle pool.
        
        Args:
            name: Pack name (e.g., "Series 4 Base Pack")
            quantity: Number of packs to add
            series: Series name (e.g., "Series 4")
            description: Pack description
        """
        if not is_admin(interaction):
            await interaction.response.send_message(
                "You need admin permissions to run this command.",
                ephemeral=True
            )
            return

        if quantity <= 0:
            await interaction.response.send_message(
                "❌ Quantity must be greater than 0.",
                ephemeral=True
            )
            return

        try:
            # Check if pack already exists
            cursor.execute(prepare_query('''
                SELECT id, quantity FROM td_prize_packs
                WHERE name = ?
            '''), (name,))
            
            existing = cursor.fetchone()

            if existing:
                # Update quantity
                pack_id, current_qty = existing
                new_qty = current_qty + quantity
                
                cursor.execute(prepare_query('''
                    UPDATE td_prize_packs
                    SET quantity = ?,
                        description = COALESCE(?, description),
                        series = COALESCE(?, series)
                    WHERE id = ?
                '''), (new_qty, description, series, pack_id))
                
                conn.commit()
                
                await interaction.response.send_message(
                    f"✅ Updated existing pack!\n"
                    f"📦 **{name}**\n"
                    f"➕ Added: **{quantity}**\n"
                    f"📊 Total available: **{new_qty}**",
                    ephemeral=True
                )
            else:
                # Insert new pack
                cursor.execute(prepare_query('''
                    INSERT INTO td_prize_packs (name, description, series, quantity)
                    VALUES (?, ?, ?, ?)
                '''), (name, description or '', series or '', quantity))
                
                conn.commit()
                
                series_text = f"\n🎯 Series: **{series}**" if series else ""
                desc_text = f"\n📝 {description}" if description else ""
                
                await interaction.response.send_message(
                    f"✅ Prize pack added!\n"
                    f"📦 **{name}**{series_text}\n"
                    f"📊 Quantity: **{quantity}**{desc_text}",
                    ephemeral=True
                )

        except Exception as e:
            print(f"Error adding pack: {e}")
            await interaction.response.send_message(
                "❌ Failed to add pack. Please try again.",
                ephemeral=True
            )

    @bot.tree.command(
        name="td_remove_pack",
        description="Admin only: Remove prize packs from the TD Watch pool"
    )
    @commands.has_permissions(administrator=True)
    async def td_remove_pack(
        interaction: discord.Interaction,
        name: str,
        quantity: int
    ):
        """Remove prize packs from the raffle pool.
        
        Args:
            name: Pack name (must match exactly)
            quantity: Number of packs to remove
        """
        if not is_admin(interaction):
            await interaction.response.send_message(
                "You need admin permissions to run this command.",
                ephemeral=True
            )
            return

        if quantity <= 0:
            await interaction.response.send_message(
                "❌ Quantity must be greater than 0.",
                ephemeral=True
            )
            return

        try:
            # Check if pack exists
            cursor.execute(prepare_query('''
                SELECT id, quantity FROM td_prize_packs
                WHERE name = ?
            '''), (name,))
            
            pack = cursor.fetchone()
            
            if not pack:
                await interaction.response.send_message(
                    f"❌ Pack not found: **{name}**\n"
                    f"Use `/td_list_packs` to see available packs.",
                    ephemeral=True
                )
                return

            pack_id, current_qty = pack

            if quantity > current_qty:
                await interaction.response.send_message(
                    f"❌ Cannot remove {quantity} packs.\n"
                    f"Only **{current_qty}** available for **{name}**.",
                    ephemeral=True
                )
                return

            new_qty = current_qty - quantity

            if new_qty == 0:
                # Delete the pack entirely
                cursor.execute(prepare_query('''
                    DELETE FROM td_prize_packs WHERE id = ?
                '''), (pack_id,))
                
                conn.commit()
                
                await interaction.response.send_message(
                    f"✅ Pack removed completely!\n"
                    f"📦 **{name}**\n"
                    f"➖ Removed all **{quantity}** packs",
                    ephemeral=True
                )
            else:
                # Update quantity
                cursor.execute(prepare_query('''
                    UPDATE td_prize_packs
                    SET quantity = ?
                    WHERE id = ?
                '''), (new_qty, pack_id))
                
                conn.commit()
                
                await interaction.response.send_message(
                    f"✅ Pack quantity updated!\n"
                    f"📦 **{name}**\n"
                    f"➖ Removed: **{quantity}**\n"
                    f"📊 Remaining: **{new_qty}**",
                    ephemeral=True
                )

        except Exception as e:
            print(f"Error removing pack: {e}")
            await interaction.response.send_message(
                "❌ Failed to remove pack. Please try again.",
                ephemeral=True
            )

    @bot.tree.command(
        name="td_list_packs",
        description="View all available prize packs in the TD Watch pool"
    )
    async def td_list_packs(interaction: discord.Interaction):
        """List all available prize packs."""
        try:
            cursor.execute(prepare_query('''
                SELECT name, series, quantity, description
                FROM td_prize_packs
                ORDER BY quantity DESC, name ASC
            '''))
            
            packs = cursor.fetchall()

            if not packs:
                await interaction.response.send_message(
                    "📦 No prize packs available.\n"
                    "Admins can add packs with `/td_add_pack`.",
                    ephemeral=True
                )
                return

            # Build formatted list
            response = "🎁 **TD Watch Prize Pack Pool**\n\n"
            total_packs = 0
            
            for pack_name, series, qty, desc in packs:
                total_packs += qty
                series_badge = f"[{series}] " if series else ""
                desc_text = f"\n   _{desc}_" if desc else ""
                response += f"📦 **{qty}x** {series_badge}{pack_name}{desc_text}\n"

            response += f"\n**Total Packs Available:** {total_packs}"

            await interaction.response.send_message(response, ephemeral=True)

        except Exception as e:
            print(f"Error listing packs: {e}")
            await interaction.response.send_message(
                "❌ Failed to retrieve packs. Please try again.",
                ephemeral=True
            )

    @bot.tree.command(
        name="td_list_games",
        description="View upcoming Nuggets games and recent results"
    )
    async def td_list_games(interaction: discord.Interaction, limit: int = 10):
        """List upcoming and recent Nuggets games."""
        try:
            cursor.execute(prepare_query('''
                SELECT game_date, opponent, is_home, played, triple_double, 
                       points, rebounds, assists
                FROM nuggets_schedule
                ORDER BY game_date DESC
                LIMIT ?
            '''), (limit,))
            
            games = cursor.fetchall()

            if not games:
                await interaction.response.send_message(
                    "📅 No games scheduled.\n"
                    "Admins can add games with `/td_add_game`.",
                    ephemeral=True
                )
                return

            response = f"📅 **Nuggets Schedule (Last {len(games)} games)**\n\n"
            
            for date, opp, home, played, td, pts, reb, ast in games:
                home_away = "vs" if home else "@"
                
                if played:
                    td_icon = "🎉" if td else "📊"
                    stats = f"{pts}/{reb}/{ast}"
                    response += f"{td_icon} **{date}** {home_away} {opp}: {stats}\n"
                else:
                    response += f"📌 **{date}** {home_away} {opp} (Not played)\n"

            await interaction.response.send_message(response, ephemeral=True)

        except Exception as e:
            print(f"Error listing games: {e}")
            await interaction.response.send_message(
                "❌ Failed to retrieve games. Please try again.",
                ephemeral=True
            )
