"""Unit tests for contest commands module."""

import pytest
from unittest.mock import Mock, AsyncMock


class TestContestCommands:
    """Test contest and prediction commands."""

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

    def test_register_contest_commands(self, mock_bot, mock_db):
        """Test that contest commands module exists."""
        # Just test that the module file exists
        import importlib.util
        spec = importlib.util.find_spec('bot.contest_commands')
        assert spec is not None, "bot.contest_commands module not found"

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
        interaction.response = AsyncMock()
        return interaction
