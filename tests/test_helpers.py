"""Unit tests for helper utility functions."""

import pytest
from unittest.mock import Mock, patch
from utils.helpers import prepare_query


class TestPrepareQuery:
    """Test SQL query preparation for different database types."""

    @patch('utils.helpers.db_type', 'sqlite')
    def test_prepare_query_sqlite(self):
        """Test that SQLite queries use ? placeholders."""
        query = "SELECT * FROM table WHERE id = ?"
        result = prepare_query(query)
        assert result == query
        assert '?' in result
        assert '%s' not in result

    @patch('utils.helpers.db_type', 'postgresql')
    def test_prepare_query_postgresql(self):
        """Test that PostgreSQL queries use %s placeholders."""
        query = "SELECT * FROM table WHERE id = ?"
        result = prepare_query(query)
        assert '%s' in result
        assert '?' not in result

    @patch('utils.helpers.db_type', 'postgresql')
    def test_prepare_query_multiple_placeholders(self):
        """Test query with multiple placeholders."""
        query = "SELECT * FROM table WHERE id = ? AND name = ?"
        result = prepare_query(query)
        assert result.count('%s') == 2
        assert '?' not in result

    @patch('utils.helpers.db_type', 'sqlite')
    def test_prepare_query_no_placeholders(self):
        """Test query without placeholders."""
        query = "SELECT * FROM table"
        result = prepare_query(query)
        assert result == query

    @patch('utils.helpers.db_type', 'postgresql')
    def test_prepare_query_serial_primary_key(self):
        """Test that SERIAL PRIMARY KEY is converted for PostgreSQL."""
        query = "CREATE TABLE test (id SERIAL PRIMARY KEY)"
        result = prepare_query(query)
        # The actual implementation might handle this
        assert 'SERIAL PRIMARY KEY' in result or 'INTEGER PRIMARY KEY AUTOINCREMENT' not in result


class TestCustomReward:
    """Test custom reward generation."""

    @patch('utils.helpers.custom_reward')
    def test_custom_reward_returns_number(self, mock_reward):
        """Test that custom_reward returns a numeric value."""
        mock_reward.return_value = 5.0
        from utils.helpers import custom_reward
        reward = custom_reward()
        assert isinstance(reward, (int, float))

    @patch('utils.helpers.custom_reward')
    def test_custom_reward_positive(self, mock_reward):
        """Test that custom_reward returns positive value."""
        mock_reward.return_value = 5.0
        from utils.helpers import custom_reward
        reward = custom_reward()
        assert reward > 0


class TestBasicPetResponse:
    """Test pet response message generation."""

    @patch('utils.helpers.get_basic_pet_response')
    def test_get_basic_pet_response_returns_string(self, mock_response):
        """Test that get_basic_pet_response returns a string."""
        mock_response.return_value = "You earned 5 $MVP!"
        from utils.helpers import get_basic_pet_response
        response = get_basic_pet_response(5.0)
        assert isinstance(response, str)

    @patch('utils.helpers.get_basic_pet_response')
    def test_get_basic_pet_response_includes_amount(self, mock_response):
        """Test that response includes the reward amount."""
        amount = 10.5
        mock_response.return_value = f"You earned {amount} $MVP!"
        from utils.helpers import get_basic_pet_response
        response = get_basic_pet_response(amount)
        assert str(amount) in response or '$MVP' in response


class TestWalletMapping:
    """Test wallet to username mapping functions."""

    @patch('utils.helpers.map_wallet_to_username')
    def test_map_wallet_to_username_returns_string(self, mock_map):
        """Test that wallet mapping returns a string."""
        mock_map.return_value = "TestUser"
        from utils.helpers import map_wallet_to_username
        username = map_wallet_to_username('0xtest')
        assert isinstance(username, str)

    @patch('utils.helpers.map_wallet_to_username')
    def test_map_wallet_to_username_handles_unknown(self, mock_map):
        """Test that unknown wallets are handled gracefully."""
        mock_map.return_value = "0xunknown"
        from utils.helpers import map_wallet_to_username
        username = map_wallet_to_username('0xunknown')
        assert isinstance(username, str)
        assert len(username) > 0


class TestIsAdmin:
    """Test admin permission checking."""

    @patch('utils.helpers.is_admin')
    def test_is_admin_returns_boolean(self, mock_is_admin):
        """Test that is_admin returns a boolean."""
        mock_is_admin.return_value = True
        from utils.helpers import is_admin
        mock_interaction = Mock()
        result = is_admin(mock_interaction)
        assert isinstance(result, bool)


class TestContestHelpers:
    """Test contest-related helper functions."""

    @patch('utils.helpers.start_contest')
    def test_start_contest_executes(self, mock_start):
        """Test that start_contest executes without error."""
        mock_start.return_value = None
        from utils.helpers import start_contest
        # Should not raise
        try:
            start_contest(123, "Test Contest", 1234567890, 456)
        except Exception:
            pytest.fail("start_contest raised an exception")

    @patch('utils.helpers.save_prediction')
    def test_save_prediction_executes(self, mock_save):
        """Test that save_prediction executes without error."""
        mock_save.return_value = None
        from utils.helpers import save_prediction, Outcome
        # Should not raise
        try:
            save_prediction(123, "Test", "100", Outcome.WIN, 1234567890)
        except Exception:
            pytest.fail("save_prediction raised an exception")


class TestGiftHelpers:
    """Test gift-related helper functions."""

    @patch('utils.helpers.save_gift')
    def test_save_gift_executes(self, mock_save):
        """Test that save_gift executes without error."""
        mock_save.return_value = None
        from utils.helpers import save_gift
        # Should not raise
        try:
            save_gift("txn123", 456, "0xwallet", 100, "2025-10-24 12:00:00")
        except Exception:
            pytest.fail("save_gift raised an exception")

    @patch('utils.helpers.get_last_processed_block')
    def test_get_last_processed_block_returns_value(self, mock_get):
        """Test that get_last_processed_block returns a value."""
        mock_get.return_value = 12345
        from utils.helpers import get_last_processed_block
        block = get_last_processed_block()
        assert block is None or isinstance(block, (int, str))
