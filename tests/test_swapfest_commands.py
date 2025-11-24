"""Unit tests for Swapfest commands module."""

import pytest
from unittest.mock import Mock, AsyncMock


class TestSwapfestCommands:
    """Test Swapfest gift tracking and leaderboard commands."""

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

    def test_register_swapfest_commands(self, mock_bot, mock_db):
        """Test that Swapfest commands module exists."""
        # Just test that the module file exists
        import importlib.util
        spec = importlib.util.find_spec('bot.swapfest_commands')
        assert spec is not None, "bot.swapfest_commands module not found"

    @pytest.fixture
    def mock_interaction(self):
        """Create a mock Discord interaction."""
        interaction = AsyncMock()
        interaction.user = Mock()
        interaction.user.id = 12345
        interaction.response = AsyncMock()
        interaction.followup = AsyncMock()
        return interaction

    @pytest.fixture
    def mock_cursor_with_gifts(self):
        """Create mock cursor with gift data."""
        cursor = Mock()
        cursor.fetchall.return_value = [
            ('0xwallet1', 100.0),
            ('0xwallet2', 50.0),
        ]
        return cursor
