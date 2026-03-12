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

    @patch('db.init.get_db_connection')
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

    @patch('db.init.get_db_connection')
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


class TestSwapComplete:
    """Test /api/swap/complete endpoint with on-chain verification."""

    def _flow_sealed_response(self, deposited_moment_ids, treasury='f853bd09d46e7db6'):
        """Build a mock Flow REST API response with TopShot.Deposit events."""
        import base64 as _b64
        import json as _json

        events = []
        for mid in deposited_moment_ids:
            payload = {
                'type': 'Event',
                'value': {
                    'id': 'A.0b2a3299cc857e29.TopShot.Deposit',
                    'fields': [
                        {'name': 'id', 'value': {'type': 'UInt64', 'value': str(mid)}},
                        {'name': 'to', 'value': {
                            'type': 'Optional',
                            'value': {'type': 'Address', 'value': f'0x{treasury}'},
                        }},
                    ],
                },
            }
            events.append({
                'type': 'A.0b2a3299cc857e29.TopShot.Deposit',
                'transaction_id': 'abc123',
                'payload': _b64.b64encode(_json.dumps(payload).encode()).decode(),
            })
        return {
            'status': 'SEALED',
            'error_message': '',
            'events': events,
        }

    @patch('routes.api.http_requests')
    @patch('routes.api.get_db')
    def test_missing_fields_returns_400(self, mock_get_db, mock_http, client):
        """Missing txId / userAddr / momentIds → 400."""
        resp = client.post('/api/swap/complete',
                           data=json.dumps({'txId': '', 'userAddr': '', 'momentIds': []}),
                           content_type='application/json')
        assert resp.status_code == 400

    @patch('routes.api.http_requests')
    @patch('routes.api.get_db')
    def test_replay_rejected(self, mock_get_db, mock_http, client):
        """Duplicate txId → 409."""
        mock_db = Mock()
        mock_cursor = Mock()
        mock_db.cursor.return_value = mock_cursor
        mock_get_db.return_value = mock_db
        # fetchone returns a row → replay
        mock_cursor.fetchone.return_value = ('already_done',)

        resp = client.post('/api/swap/complete',
                           data=json.dumps({'txId': 'tx1', 'userAddr': '0xabc', 'momentIds': [1]}),
                           content_type='application/json')
        assert resp.status_code == 409
        assert 'already been processed' in resp.get_json()['error']

    @patch('routes.api.http_requests')
    @patch('routes.api.get_db')
    def test_unsealed_tx_rejected(self, mock_get_db, mock_http, client):
        """Non-sealed transaction → 400."""
        mock_db = Mock()
        mock_cursor = Mock()
        mock_db.cursor.return_value = mock_cursor
        mock_get_db.return_value = mock_db
        mock_cursor.fetchone.return_value = None  # no replay

        flow_resp = Mock()
        flow_resp.status_code = 200
        flow_resp.json.return_value = {'status': 'PENDING', 'error_message': '', 'events': []}
        mock_http.get.return_value = flow_resp

        resp = client.post('/api/swap/complete',
                           data=json.dumps({'txId': 'tx1', 'userAddr': '0xabc', 'momentIds': [1]}),
                           content_type='application/json')
        assert resp.status_code == 400
        assert 'not sealed' in resp.get_json()['error'].lower()

    @patch('routes.api.http_requests')
    @patch('routes.api.get_db')
    def test_missing_deposit_rejected(self, mock_get_db, mock_http, client):
        """Claimed moment not in Deposit events → 400."""
        mock_db = Mock()
        mock_cursor = Mock()
        mock_db.cursor.return_value = mock_cursor
        mock_get_db.return_value = mock_db
        mock_cursor.fetchone.return_value = None

        flow_resp = Mock()
        flow_resp.status_code = 200
        # Only moment 99 deposited, but user claims 1
        flow_resp.json.return_value = self._flow_sealed_response([99])
        mock_http.get.return_value = flow_resp

        resp = client.post('/api/swap/complete',
                           data=json.dumps({'txId': 'tx1', 'userAddr': '0xabc', 'momentIds': [1]}),
                           content_type='application/json')
        assert resp.status_code == 400
        assert 'verification failed' in resp.get_json()['error'].lower()

    @patch('routes.api._get_moment_tier')
    @patch('routes.api.FLOW_SWAP_PRIVATE_KEY', '')
    @patch('routes.api.http_requests')
    @patch('routes.api.get_db')
    def test_valid_swap_no_treasury_key(self, mock_get_db, mock_http,
                                        mock_tier, client):
        """Valid on-chain swap but no FLOW_SWAP_PRIVATE_KEY → 200 with note."""
        mock_db = Mock()
        mock_cursor = Mock()
        mock_db.cursor.return_value = mock_cursor
        mock_get_db.return_value = mock_db
        mock_cursor.fetchone.return_value = None  # no replay

        flow_resp = Mock()
        flow_resp.status_code = 200
        flow_resp.json.return_value = self._flow_sealed_response([42, 43])
        mock_http.get.return_value = flow_resp

        mock_tier.return_value = 'COMMON'

        resp = client.post('/api/swap/complete',
                           data=json.dumps({'txId': 'tx_ok', 'userAddr': '0xabc',
                                            'momentIds': [42, 43]}),
                           content_type='application/json')
        data = resp.get_json()
        assert resp.status_code == 200
        assert data['mvpAmount'] == 3  # 1.5 COMMON × 2
        assert data['mvpTxId'] is None
        assert 'note' in data
        assert data['boostApplied'] is False

    # ── Horse NFT boost tests ─────────────────────────────────────

    def _horse_deposit_event(self, nft_id, recipient='cc4b6fa5550a4610'):
        """Build a mock NonFungibleToken.Deposited event for a Swapboost30MVP NFT.

        The contract uses Flowty UniversalCollection, so on-chain deposits
        emit the standard NonFungibleToken.Deposited event with an embedded
        ``type`` field identifying the NFT contract.
        """
        import base64 as _b64
        import json as _json

        payload = {
            'type': 'Event',
            'value': {
                'id': 'A.1d7e57aa55817448.NonFungibleToken.Deposited',
                'fields': [
                    {'name': 'type', 'value': {'type': 'String', 'value': 'A.aad9f8fa31ecbaf9.Swapboost30MVP.NFT'}},
                    {'name': 'id', 'value': {'type': 'UInt64', 'value': str(nft_id)}},
                    {'name': 'uuid', 'value': {'type': 'UInt64', 'value': '999'}},
                    {'name': 'to', 'value': {
                        'type': 'Optional',
                        'value': {'type': 'Address', 'value': f'0x{recipient}'},
                    }},
                    {'name': 'collectionUUID', 'value': {'type': 'UInt64', 'value': '888'}},
                ],
            },
        }
        return {
            'type': 'A.1d7e57aa55817448.NonFungibleToken.Deposited',
            'transaction_id': 'abc123',
            'payload': _b64.b64encode(_json.dumps(payload).encode()).decode(),
        }

    @patch('routes.api._get_moment_tier')
    @patch('routes.api.FLOW_SWAP_PRIVATE_KEY', '')
    @patch('routes.api.http_requests')
    @patch('routes.api.get_db')
    def test_boost_applies_20pct(self, mock_get_db, mock_http,
                                  mock_tier, client):
        """Valid swap with horse boost → 200, mvpAmount is 1.2× base."""
        mock_db = Mock()
        mock_cursor = Mock()
        mock_db.cursor.return_value = mock_cursor
        mock_get_db.return_value = mock_db
        mock_cursor.fetchone.return_value = None

        sealed = self._flow_sealed_response([42, 43])
        # Add horse NFT deposit event to the swap treasury
        sealed['events'].append(self._horse_deposit_event(7))

        flow_resp = Mock()
        flow_resp.status_code = 200
        flow_resp.json.return_value = sealed
        mock_http.get.return_value = flow_resp

        mock_tier.return_value = 'COMMON'

        resp = client.post('/api/swap/complete',
                           data=json.dumps({'txId': 'tx_boost', 'userAddr': '0xabc',
                                            'momentIds': [42, 43],
                                            'boostNftId': 7}),
                           content_type='application/json')
        data = resp.get_json()
        assert resp.status_code == 200
        # 1.5 COMMON × 2 = 3.0, boosted × 1.2 = 3.6
        assert data['mvpAmount'] == pytest.approx(3.6)
        assert data['boostApplied'] is True

    @patch('routes.api.http_requests')
    @patch('routes.api.get_db')
    def test_boost_wrong_recipient_rejected(self, mock_get_db, mock_http, client):
        """Horse NFT deposited to wrong address → 400."""
        mock_db = Mock()
        mock_cursor = Mock()
        mock_db.cursor.return_value = mock_cursor
        mock_get_db.return_value = mock_db
        mock_cursor.fetchone.return_value = None

        sealed = self._flow_sealed_response([42])
        # Horse goes to wrong address (Dapper treasury instead of Flow swap)
        sealed['events'].append(self._horse_deposit_event(7, 'f853bd09d46e7db6'))

        flow_resp = Mock()
        flow_resp.status_code = 200
        flow_resp.json.return_value = sealed
        mock_http.get.return_value = flow_resp

        resp = client.post('/api/swap/complete',
                           data=json.dumps({'txId': 'tx_bad', 'userAddr': '0xabc',
                                            'momentIds': [42],
                                            'boostNftId': 7}),
                           content_type='application/json')
        assert resp.status_code == 400
        assert 'not verified' in resp.get_json()['error'].lower()

    @patch('routes.api.http_requests')
    @patch('routes.api.get_db')
    def test_boost_wrong_nft_id_rejected(self, mock_get_db, mock_http, client):
        """Horse NFT id mismatch → 400."""
        mock_db = Mock()
        mock_cursor = Mock()
        mock_db.cursor.return_value = mock_cursor
        mock_get_db.return_value = mock_db
        mock_cursor.fetchone.return_value = None

        sealed = self._flow_sealed_response([42])
        # Horse #5 deposited, but user claims boost with #7
        sealed['events'].append(self._horse_deposit_event(5))

        flow_resp = Mock()
        flow_resp.status_code = 200
        flow_resp.json.return_value = sealed
        mock_http.get.return_value = flow_resp

        resp = client.post('/api/swap/complete',
                           data=json.dumps({'txId': 'tx_wrong', 'userAddr': '0xabc',
                                            'momentIds': [42],
                                            'boostNftId': 7}),
                           content_type='application/json')
        assert resp.status_code == 400
        assert '#7' in resp.get_json()['error']

    @patch('routes.api._get_moment_tier')
    @patch('routes.api.FLOW_SWAP_PRIVATE_KEY', '')
    @patch('routes.api.http_requests')
    @patch('routes.api.get_db')
    def test_no_boost_field_ignored(self, mock_get_db, mock_http,
                                     mock_tier, client):
        """Swap without boostNftId → no boost applied (backward compat)."""
        mock_db = Mock()
        mock_cursor = Mock()
        mock_db.cursor.return_value = mock_cursor
        mock_get_db.return_value = mock_db
        mock_cursor.fetchone.return_value = None

        flow_resp = Mock()
        flow_resp.status_code = 200
        flow_resp.json.return_value = self._flow_sealed_response([42])
        mock_http.get.return_value = flow_resp

        mock_tier.return_value = 'RARE'

        resp = client.post('/api/swap/complete',
                           data=json.dumps({'txId': 'tx_noboost', 'userAddr': '0xabc',
                                            'momentIds': [42]}),
                           content_type='application/json')
        data = resp.get_json()
        assert resp.status_code == 200
        assert data['mvpAmount'] == 75  # RARE rate, no boost
        assert data['boostApplied'] is False
