"""Unit tests for Fastbreak Bracket tournament API endpoints."""

import pytest
import json
import math
from unittest.mock import Mock, patch, MagicMock
from flask import Flask
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


# ── Helper to build a mock DB that returns configurable rows ──

def _mock_db(fetchone_val=None, fetchall_val=None):
    mock_cursor = Mock()
    mock_db = Mock()
    mock_db.cursor.return_value = mock_cursor
    mock_cursor.fetchone.return_value = fetchone_val
    mock_cursor.fetchall.return_value = fetchall_val or []
    return mock_db, mock_cursor


class TestListBracketTournaments:
    """GET /api/bracket/tournaments"""

    @patch('routes.api.get_db')
    def test_returns_empty_list(self, mock_get_db, client):
        db, cursor = _mock_db(fetchall_val=[])
        mock_get_db.return_value = db
        # First fetchall for tournaments, then for each participant count
        resp = client.get('/api/bracket/tournaments')
        assert resp.status_code == 200
        assert json.loads(resp.data) == []

    @patch('routes.api.get_db')
    def test_returns_tournaments(self, mock_get_db, client):
        db, cursor = _mock_db()
        mock_get_db.return_value = db

        # Tournament row
        tournament_row = (1, 'Test Cup', 5.0, '$MVP', 9999999999, 'SIGNUP', 0, None, '2026-01-01')
        cursor.fetchall.side_effect = [
            [tournament_row],  # tournament list
        ]
        cursor.fetchone.return_value = (3,)  # participant count

        resp = client.get('/api/bracket/tournaments')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert len(data) == 1
        assert data[0]['name'] == 'Test Cup'
        assert data[0]['participant_count'] == 3


class TestCreateBracketTournament:
    """POST /api/bracket/tournaments"""

    @patch('db.init.get_db_connection')
    def test_create_tournament(self, mock_conn_fn, client):
        """Successfully create a new tournament."""
        mock_conn = Mock()
        mock_cursor = Mock()
        mock_conn.cursor.return_value = mock_cursor
        mock_cursor.fetchone.return_value = (42,)
        mock_conn_fn.return_value = (mock_conn, 'sqlite')

        resp = client.post('/api/bracket/tournaments', json={
            'name': 'My Bracket',
            'fee_amount': 10,
            'fee_currency': '$MVP',
            'signup_close_ts': 9999999999,
        })
        assert resp.status_code == 201
        data = json.loads(resp.data)
        assert data['id'] == 42
        assert data['name'] == 'My Bracket'
        assert data['status'] == 'SIGNUP'
        mock_conn.commit.assert_called_once()
        mock_conn.close.assert_called_once()

    def test_create_missing_name(self, client):
        """Missing name should return 400."""
        resp = client.post('/api/bracket/tournaments', json={
            'signup_close_ts': 9999999999,
        })
        assert resp.status_code == 400

    def test_create_missing_close_ts(self, client):
        """Missing signup_close_ts should return 400."""
        resp = client.post('/api/bracket/tournaments', json={
            'name': 'No TS',
        })
        assert resp.status_code == 400


class TestGetBracketTournament:
    """GET /api/bracket/tournament/<id>"""

    @patch('routes.api.get_db')
    def test_not_found(self, mock_get_db, client):
        db, cursor = _mock_db(fetchone_val=None)
        mock_get_db.return_value = db
        resp = client.get('/api/bracket/tournament/999')
        assert resp.status_code == 404

    @patch('routes.api.get_db')
    def test_returns_detail(self, mock_get_db, client):
        db, cursor = _mock_db()
        mock_get_db.return_value = db

        # First fetchone: tournament row
        tournament_row = (1, 'Test Cup', 5.0, '$MVP', 9999999999, 'ACTIVE', 1, None, '2026-01-01')
        participant_rows = [
            (1, '0xaaa', 'user1', 1, None),
            (2, '0xbbb', 'user2', 2, None),
        ]
        matchup_rows = [
            (1, 1, 0, '0xaaa', '0xbbb', None, None, None, None, None, None, None, None, 'PENDING'),
        ]

        cursor.fetchone.return_value = tournament_row
        cursor.fetchall.side_effect = [participant_rows, matchup_rows]

        resp = client.get('/api/bracket/tournament/1')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data['name'] == 'Test Cup'
        assert len(data['participants']) == 2
        assert data['total_rounds'] == 1


class TestBracketSignup:
    """POST /api/bracket/tournament/<id>/signup"""

    @patch('routes.api.get_ts_username_from_flow_wallet', return_value='tsuser1')
    @patch('db.init.get_db_connection')
    def test_signup_success(self, mock_get_conn, mock_ts, client):
        db, cursor = _mock_db()
        mock_get_conn.return_value = (db, 'sqlite')

        import time
        future_ts = int(time.time()) + 3600
        # Tournament row
        cursor.fetchone.side_effect = [
            (future_ts, 'SIGNUP'),  # tournament check
            None,                    # duplicate check (no existing)
        ]

        resp = client.post(
            '/api/bracket/tournament/1/signup',
            data=json.dumps({'wallet': '0xTestWallet'}),
            content_type='application/json',
        )
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data['success'] is True
        assert data['ts_username'] == 'tsuser1'

    @patch('routes.api.get_ts_username_from_flow_wallet', return_value=None)
    @patch('db.init.get_db_connection')
    def test_signup_no_username(self, mock_get_conn, mock_ts, client):
        db, cursor = _mock_db()
        mock_get_conn.return_value = (db, 'sqlite')

        resp = client.post(
            '/api/bracket/tournament/1/signup',
            data=json.dumps({'wallet': '0xNoUser'}),
            content_type='application/json',
        )
        assert resp.status_code == 400
        data = json.loads(resp.data)
        assert 'TopShot username' in data['error']

    @patch('routes.api.get_ts_username_from_flow_wallet', return_value='user1')
    @patch('db.init.get_db_connection')
    def test_signup_closed(self, mock_get_conn, mock_ts, client):
        db, cursor = _mock_db()
        mock_get_conn.return_value = (db, 'sqlite')

        cursor.fetchone.return_value = (1000000, 'ACTIVE')  # not SIGNUP

        resp = client.post(
            '/api/bracket/tournament/1/signup',
            data=json.dumps({'wallet': '0xUser'}),
            content_type='application/json',
        )
        assert resp.status_code == 403

    def test_signup_missing_wallet(self, client):
        resp = client.post(
            '/api/bracket/tournament/1/signup',
            data=json.dumps({}),
            content_type='application/json',
        )
        assert resp.status_code == 400


class TestBracketGenerate:
    """POST /api/bracket/tournament/<id>/generate"""

    @patch('db.init.get_db_connection')
    def test_generate_bracket(self, mock_get_conn, client):
        db, cursor = _mock_db()
        mock_get_conn.return_value = (db, 'sqlite')

        # Status check
        cursor.fetchone.return_value = ('SIGNUP',)
        # Participants
        cursor.fetchall.return_value = [
            (1, '0xaaa', 'user1'),
            (2, '0xbbb', 'user2'),
            (3, '0xccc', 'user3'),
        ]

        resp = client.post('/api/bracket/tournament/1/generate')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data['success'] is True
        assert data['participants'] == 3
        assert data['total_rounds'] == 2  # ceil(log2(3))
        assert data['byes'] == 1  # 4 - 3

    @patch('db.init.get_db_connection')
    def test_generate_too_few(self, mock_get_conn, client):
        db, cursor = _mock_db()
        mock_get_conn.return_value = (db, 'sqlite')

        cursor.fetchone.return_value = ('SIGNUP',)
        cursor.fetchall.return_value = [(1, '0xaaa', 'user1')]

        resp = client.post('/api/bracket/tournament/1/generate')
        assert resp.status_code == 400
        assert 'at least 2' in json.loads(resp.data)['error']

    @patch('db.init.get_db_connection')
    def test_generate_already_active(self, mock_get_conn, client):
        db, cursor = _mock_db()
        mock_get_conn.return_value = (db, 'sqlite')

        cursor.fetchone.return_value = ('ACTIVE',)

        resp = client.post('/api/bracket/tournament/1/generate')
        assert resp.status_code == 400


class TestBracketAdvance:
    """POST /api/bracket/tournament/<id>/advance"""

    @patch('routes.api.get_rank_and_lineup_for_user')
    @patch('db.init.get_db_connection')
    def test_advance_scores_and_creates_next_round(self, mock_get_conn, mock_get_fb, client):
        db, cursor = _mock_db()
        mock_get_conn.return_value = (db, 'sqlite')

        # Tournament status
        cursor.fetchone.side_effect = [
            ('ACTIVE', 1),            # tournament status + current_round
        ]
        # Pending matchups for round 1
        # Then wallet-to-username map
        # Then BYE winners
        cursor.fetchall.side_effect = [
            [(1, '0xaaa', '0xbbb')],              # pending matchups
            [('0xaaa', 'user1'), ('0xbbb', 'user2')],  # wallet→username
            [],                                    # BYE winners
        ]

        # Mock TopShot API responses — higher points wins
        mock_get_fb.side_effect = lambda username, fb_id: (
            {'rank': 5, 'points': 210, 'players': ['LeBron James', 'Steph Curry']} if username == 'user1'
            else {'rank': 10, 'points': 180, 'players': ['Luka Doncic', 'Ja Morant']}
        )

        resp = client.post(
            '/api/bracket/tournament/1/advance',
            data=json.dumps({'fastbreak_id': 'fb123'}),
            content_type='application/json',
        )
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data['success'] is True
        # With only 1 matchup, the single winner ends the tournament
        assert data['status'] == 'COMPLETE'

    @patch('db.init.get_db_connection')
    def test_advance_missing_fastbreak_id(self, mock_get_conn, client):
        db, cursor = _mock_db()
        mock_get_conn.return_value = (db, 'sqlite')

        resp = client.post(
            '/api/bracket/tournament/1/advance',
            data=json.dumps({}),
            content_type='application/json',
        )
        assert resp.status_code == 400

    @patch('db.init.get_db_connection')
    def test_advance_not_active(self, mock_get_conn, client):
        db, cursor = _mock_db()
        mock_get_conn.return_value = (db, 'sqlite')

        cursor.fetchone.return_value = ('SIGNUP', 0)

        resp = client.post(
            '/api/bracket/tournament/1/advance',
            data=json.dumps({'fastbreak_id': 'fb123'}),
            content_type='application/json',
        )
        assert resp.status_code == 400
