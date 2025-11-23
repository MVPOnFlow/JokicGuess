"""Unit tests for configuration module."""

import pytest
import os
from config import (
    SWAPFEST_START_TIME, SWAPFEST_END_TIME,
    SWAPFEST_BOOST1_CUTOFF, SWAPFEST_BOOST2_CUTOFF,
    PETTING_ALLOWED_CHANNEL_ID, DEFAULT_FREE_DAILY_PETS,
    SPECIAL_REWARD_ODDS, FLOW_ACCOUNT, FLASK_HOST, FLASK_PORT
)


class TestConfig:
    """Test configuration constants."""

    def test_swapfest_times_format(self):
        """Test that swapfest times are in correct format."""
        assert isinstance(SWAPFEST_START_TIME, str)
        assert isinstance(SWAPFEST_END_TIME, str)
        assert len(SWAPFEST_START_TIME) == 19  # YYYY-MM-DD HH:MM:SS
        assert len(SWAPFEST_END_TIME) == 19

    def test_swapfest_boost_cutoffs(self):
        """Test that boost cutoffs are properly formatted."""
        assert isinstance(SWAPFEST_BOOST1_CUTOFF, str)
        assert isinstance(SWAPFEST_BOOST2_CUTOFF, str)
        assert len(SWAPFEST_BOOST1_CUTOFF) == 19
        assert len(SWAPFEST_BOOST2_CUTOFF) == 19

    def test_petting_channel_id(self):
        """Test that petting channel ID is an integer."""
        assert isinstance(PETTING_ALLOWED_CHANNEL_ID, int)
        assert PETTING_ALLOWED_CHANNEL_ID > 0

    def test_default_pets(self):
        """Test default daily pets configuration."""
        assert isinstance(DEFAULT_FREE_DAILY_PETS, int)
        assert DEFAULT_FREE_DAILY_PETS > 0

    def test_special_reward_odds(self):
        """Test special reward odds configuration."""
        assert isinstance(SPECIAL_REWARD_ODDS, float)
        assert 0 < SPECIAL_REWARD_ODDS < 1

    def test_flow_account(self):
        """Test Flow blockchain account address."""
        assert isinstance(FLOW_ACCOUNT, str)
        assert FLOW_ACCOUNT.startswith('0x')
        assert len(FLOW_ACCOUNT) == 18  # 0x + 16 hex chars

    def test_flask_configuration(self):
        """Test Flask server configuration."""
        assert isinstance(FLASK_HOST, str)
        assert isinstance(FLASK_PORT, int)
        assert FLASK_PORT > 0
        assert FLASK_PORT < 65536
