"""Test configuration and fixtures for pytest."""

import pytest
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


@pytest.fixture(autouse=True)
def mock_env_vars(monkeypatch):
    """Mock environment variables for testing."""
    # Don't set DATABASE_URL to force SQLite mode in tests
    monkeypatch.delenv('DATABASE_URL', raising=False)
    monkeypatch.delenv('DISCORD_TOKEN', raising=False)


@pytest.fixture
def mock_database():
    """Provide a mock database connection."""
    from unittest.mock import Mock
    
    mock_conn = Mock()
    mock_cursor = Mock()
    mock_conn.cursor.return_value = mock_cursor
    
    return mock_conn, mock_cursor


@pytest.fixture
def sample_predictions():
    """Provide sample prediction data."""
    return [
        (12345, "100", "Win", 1234567890),
        (67890, "95", "Loss", 1234567891),
        (11111, "110", "Win", 1234567892),
    ]


@pytest.fixture
def sample_gifts():
    """Provide sample gift data."""
    return [
        ("txn1", 101, "0xwallet1", 100, "2025-10-24 12:00:00"),
        ("txn2", 102, "0xwallet2", 50, "2025-10-24 13:00:00"),
        ("txn3", 103, "0xwallet1", 75, "2025-10-24 14:00:00"),
    ]


@pytest.fixture
def sample_fastbreak_entries():
    """Provide sample FastBreak contest entries."""
    return [
        (1, 1, "tsuser1", "0xwallet1", "2025-10-20 10:00:00"),
        (2, 1, "tsuser2", "0xwallet2", "2025-10-20 11:00:00"),
        (3, 1, "tsuser3", "0xwallet3", "2025-10-20 12:00:00"),
    ]
