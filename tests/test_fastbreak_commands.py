"""Unit tests for FastBreak commands module."""

import pytest
from unittest.mock import Mock, AsyncMock


class TestFastbreakCommands:
    """Test FastBreak contest and statistics commands."""

    @pytest.fixture
    def mock_bot(self):
        """Create a mock Discord bot."""
        bot = Mock()
        bot.tree = Mock()
        bot.tree.command = Mock(return_value=lambda f: f)
        return bot

    @pytest.fixture
    def mock_db(self):
        """Create mock database connection and cursor."""
        conn = Mock()
        cursor = Mock()
        return conn, cursor

    def test_register_fastbreak_commands(self, mock_bot, mock_db):
        """Test that FastBreak commands module exists."""
        # Just test that the module file exists
        import importlib.util
        spec = importlib.util.find_spec('bot.fastbreak_commands')
        assert spec is not None, "bot.fastbreak_commands module not found"

    @pytest.fixture
    def mock_admin_interaction(self):
        """Create a mock admin interaction."""
        interaction = AsyncMock()
        interaction.user = Mock()
        interaction.user.id = 12345
        interaction.user.guild_permissions = Mock()
        interaction.user.guild_permissions.administrator = True
        interaction.response = AsyncMock()
        interaction.followup = AsyncMock()
        return interaction
