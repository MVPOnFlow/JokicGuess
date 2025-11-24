"""Unit tests for petting commands module."""

import pytest
from unittest.mock import Mock, AsyncMock


class TestPettingCommands:
    """Test petting and reward commands."""

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

    def test_register_petting_commands(self, mock_bot, mock_db):
        """Test that petting commands module exists."""
        # Just test that the module file exists
        import importlib.util
        spec = importlib.util.find_spec('bot.petting_commands')
        assert spec is not None, "bot.petting_commands module not found"

    @pytest.fixture
    def mock_interaction(self):
        """Create a mock Discord interaction."""
        interaction = AsyncMock()
        interaction.user = Mock()
        interaction.user.id = 12345
        interaction.user.mention = "<@12345>"
        interaction.channel_id = 1333948717824475187  # Correct channel
        interaction.response = AsyncMock()
        return interaction
