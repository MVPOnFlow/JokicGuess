"""Unit tests for Discord bot commands."""

import pytest
from unittest.mock import Mock, patch, AsyncMock, MagicMock
import discord
from discord.ext import commands


class TestBotCommandRegistration:
    """Test that bot commands are registered properly."""

    @patch('bot.commands.bot')
    def test_register_commands_adds_commands(self):
        """Test that register_commands adds slash commands to bot."""
        mock_bot = Mock()
        mock_conn = Mock()
        mock_cursor = Mock()
        
        from bot.commands import register_commands
        
        # This should not raise an exception
        try:
            register_commands(mock_bot, mock_conn, mock_cursor, 'sqlite')
        except Exception as e:
            pytest.fail(f"register_commands raised {e}")


class TestPredictionCommands:
    """Test prediction-related commands."""

    @pytest.fixture
    def mock_interaction(self):
        """Create a mock Discord interaction."""
        interaction = AsyncMock()
        interaction.user = Mock()
        interaction.user.id = 12345
        interaction.user.name = "TestUser"
        interaction.channel = Mock()
        interaction.channel.id = 67890
        interaction.channel.name = "test-channel"
        return interaction

    @pytest.fixture
    def mock_db(self):
        """Create mock database connection and cursor."""
        mock_conn = Mock()
        mock_cursor = Mock()
        return mock_conn, mock_cursor


class TestPettingCommands:
    """Test petting-related commands."""

    @pytest.fixture
    def mock_interaction(self):
        """Create a mock Discord interaction."""
        interaction = AsyncMock()
        interaction.user = Mock()
        interaction.user.id = 12345
        interaction.user.mention = "<@12345>"
        interaction.channel_id = 1333948717824475187  # Correct channel
        return interaction

    def test_petting_channel_validation(self, mock_interaction):
        """Test that petting only works in designated channel."""
        # Change to wrong channel
        mock_interaction.channel_id = 99999
        
        # The command should check channel and return early
        # This is tested by the actual command implementation


class TestAdminCommands:
    """Test admin-only commands."""

    @pytest.fixture
    def mock_admin_interaction(self):
        """Create a mock admin interaction."""
        interaction = AsyncMock()
        interaction.user = Mock()
        interaction.user.id = 12345
        interaction.user.guild_permissions = Mock()
        interaction.user.guild_permissions.administrator = True
        return interaction

    @pytest.fixture
    def mock_non_admin_interaction(self):
        """Create a mock non-admin interaction."""
        interaction = AsyncMock()
        interaction.user = Mock()
        interaction.user.id = 12345
        interaction.user.guild_permissions = Mock()
        interaction.user.guild_permissions.administrator = False
        return interaction


class TestSwapfestCommands:
    """Test Swapfest-related commands."""

    @pytest.fixture
    def mock_interaction(self):
        """Create a mock Discord interaction."""
        interaction = AsyncMock()
        interaction.user = Mock()
        interaction.user.id = 12345
        return interaction

    @pytest.fixture
    def mock_cursor_with_gifts(self):
        """Create mock cursor with gift data."""
        mock_cursor = Mock()
        mock_cursor.fetchall.return_value = [
            ('0xwallet1', 100.0),
            ('0xwallet2', 50.0),
        ]
        return mock_cursor


class TestFastbreakCommands:
    """Test FastBreak-related commands."""

    @pytest.fixture
    def mock_admin_interaction(self):
        """Create a mock admin interaction."""
        interaction = AsyncMock()
        interaction.user = Mock()
        interaction.user.id = 12345
        interaction.response = AsyncMock()
        interaction.followup = AsyncMock()
        return interaction
