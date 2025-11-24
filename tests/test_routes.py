"""Unit tests for Flask API routes."""

import pytest
import json
from unittest.mock import Mock, patch, MagicMock
from flask import Flask, g
from routes.api import register_routes


@pytest.fixture
def app():
    """Create a test Flask application."""
    test_app = Flask(__name__)
    register_routes(test_app)
    test_app.config['TESTING'] = True
    return test_app


@pytest.fixture
def client(app):
    """Create a test client."""
    return app.test_client()


class TestReactRouting:
    """Test React SPA routing."""

    def test_serve_react_root(self, client):
        """Test that root path serves React app."""
        response = client.get('/')
        
        # Should either serve React app or return 404 if react-build doesn't exist
        assert response.status_code in [200, 404]

    def test_serve_react_static_file(self, client):
        """Test that unknown paths serve React index.html."""
        # Unknown paths should serve the React app (index.html)
        response = client.get('/unknown-path')
        
        # Should either serve index.html or return 404 (depends on react-build existence)
        # In test environment without react-build/, 404 is expected
        assert response.status_code in [200, 404]


class TestLeaderboardAPI:
    """Test leaderboard API endpoint."""

    @patch('routes.api.get_db')
    def test_api_leaderboard_returns_json(self, mock_get_db, client):
        """Test that leaderboard endpoint returns JSON."""
        mock_cursor = Mock()
        mock_db = Mock()
        mock_db.cursor.return_value = mock_cursor
        mock_get_db.return_value = mock_db
        
        # Mock database response
        mock_cursor.fetchall.return_value = [
            ('0xwallet1', 100.0, '2025-10-24 12:00:00'),
            ('0xwallet2', 50.0, '2025-10-24 13:00:00'),
        ]
        
        with patch('routes.api.map_wallet_to_username', return_value='TestUser'):
            response = client.get('/api/leaderboard')
        
        assert response.status_code == 200
        assert response.content_type == 'application/json'
        
        data = json.loads(response.data)
        assert 'prize_pool' in data
        assert 'leaderboard' in data
        assert isinstance(data['leaderboard'], list)

    @patch('routes.api.get_db')
    def test_api_leaderboard_calculates_prize_pool(self, mock_get_db, client):
        """Test that prize pool is calculated correctly."""
        mock_cursor = Mock()
        mock_db = Mock()
        mock_db.cursor.return_value = mock_cursor
        mock_get_db.return_value = mock_db
        
        mock_cursor.fetchall.return_value = [
            ('0xwallet1', 100.0, '2025-10-24 12:00:00'),
            ('0xwallet2', 50.0, '2025-10-24 13:00:00'),
        ]
        
        with patch('routes.api.map_wallet_to_username', return_value='TestUser'):
            response = client.get('/api/leaderboard')
        
        data = json.loads(response.data)
        assert data['prize_pool'] == 150.0


class TestTreasuryAPI:
    """Test treasury API endpoint."""

    def test_api_treasury_returns_json(self, client):
        """Test that treasury endpoint returns JSON."""
        response = client.get('/api/treasury')
        
        assert response.status_code == 200
        assert response.content_type == 'application/json'

    def test_api_treasury_has_required_fields(self, client):
        """Test that treasury response has all required fields."""
        response = client.get('/api/treasury')
        data = json.loads(response.data)
        
        required_fields = [
            'tokens_in_wild', 'common_count', 'rare_count',
            'tsd_count', 'lego_count', 'backed_supply',
            'surplus', 'last_updated'
        ]
        
        for field in required_fields:
            assert field in data

    def test_api_treasury_calculates_backed_supply(self, client):
        """Test that backed supply is calculated correctly."""
        response = client.get('/api/treasury')
        data = json.loads(response.data)
        
        expected_backed = (
            data['common_count'] * 2 +
            data['rare_count'] * 100 +
            data['tsd_count'] * 500 +
            data['lego_count'] * 2000
        )
        
        assert data['backed_supply'] == expected_backed


class TestFastbreakAPI:
    """Test FastBreak API endpoints."""

    @patch('routes.api.get_db')
    def test_api_fastbreak_contests_returns_list(self, mock_get_db, client):
        """Test that contests endpoint returns a list."""
        mock_cursor = Mock()
        mock_db = Mock()
        mock_db.cursor.return_value = mock_cursor
        mock_get_db.return_value = mock_db
        
        mock_cursor.fetchall.return_value = []
        
        response = client.get('/api/fastbreak/contests')
        
        assert response.status_code == 200
        assert isinstance(json.loads(response.data), list)

    @patch('routes.api.get_db')
    def test_api_fastbreak_racing_usernames(self, mock_get_db, client):
        """Test that racing usernames endpoint returns list."""
        mock_cursor = Mock()
        mock_db = Mock()
        mock_db.cursor.return_value = mock_cursor
        mock_get_db.return_value = mock_db
        
        mock_cursor.fetchall.return_value = [('user1',), ('user2',), ('user3',)]
        
        response = client.get('/api/fastbreak_racing_usernames')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert isinstance(data, list)
        assert len(data) == 3

    def test_api_has_lineup_missing_params(self, client):
        """Test that has_lineup returns error for missing params."""
        response = client.get('/api/has_lineup')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data


class TestFastbreakEntryAPI:
    """Test FastBreak entry endpoints."""

    @patch('routes.api.get_db_connection')
    def test_add_fastbreak_entry_missing_data(self, mock_get_db_conn, client):
        """Test that adding entry without data returns error."""
        mock_cursor = Mock()
        mock_conn = Mock()
        mock_conn.cursor.return_value = mock_cursor
        mock_get_db_conn.return_value = (mock_conn, 'sqlite')
        
        response = client.post(
            '/api/fastbreak/contest/1/entries',
            data=json.dumps({}),
            content_type='application/json'
        )
        
        assert response.status_code == 400

    @patch('routes.api.get_db_connection')
    def test_add_fastbreak_entry_contest_not_found(self, mock_get_db_conn, client):
        """Test that adding entry to non-existent contest returns error."""
        mock_cursor = Mock()
        mock_conn = Mock()
        mock_conn.cursor.return_value = mock_cursor
        mock_get_db_conn.return_value = (mock_conn, 'sqlite')
        
        mock_cursor.fetchone.return_value = None
        
        response = client.post(
            '/api/fastbreak/contest/999/entries',
            data=json.dumps({
                'userWalletAddress': '0xtest',
                'topshotUsernamePrediction': 'testuser'
            }),
            content_type='application/json'
        )
        
        assert response.status_code == 404
