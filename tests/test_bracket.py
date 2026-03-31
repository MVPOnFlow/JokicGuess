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

        # Tournament row (includes max_rounds as 10th, buyin_type as 11th, moment_filters as 12th column)
        tournament_row = (1, 'Test Cup', 5.0, '$MVP', 9999999999, 'SIGNUP', 0, None, '2026-01-01', 3, 'TOKEN', None)
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
        assert data[0]['buyin_type'] == 'TOKEN'


class TestCreateBracketTournament:
    """POST /api/bracket/tournaments"""

    @patch('routes.api.extract_fastbreak_runs')
    @patch('db.init.get_db_connection')
    def test_create_tournament(self, mock_conn_fn, mock_fb_runs, client):
        """Successfully create a new tournament with start_date."""
        mock_conn = Mock()
        mock_cursor = Mock()
        mock_conn.cursor.return_value = mock_cursor
        mock_cursor.fetchone.return_value = (42,)
        mock_conn_fn.return_value = (mock_conn, 'sqlite')

        # Mock fastbreak runs with 6 upcoming Classic days
        mock_fb_runs.return_value = [{
            'runName': 'Classic',
            'fastBreaks': [
                {'id': f'fb{i}', 'gameDate': f'2026-04-{10+i:02d}T00:00:00Z',
                 'gamesStartAt': f'2026-04-{10+i:02d}T23:00:00Z', 'status': 'FAST_BREAK_SCHEDULED'}
                for i in range(7)
            ]
        }]

        resp = client.post('/api/bracket/tournaments', json={
            'name': 'My Bracket',
            'fee_amount': 10,
            'fee_currency': '$MVP',
            'start_date': '2026-04-10',
        })
        assert resp.status_code == 201
        data = json.loads(resp.data)
        assert data['id'] == 42
        assert data['name'] == 'My Bracket'
        assert data['status'] == 'SIGNUP'
        assert data['rounds_mapped'] == 6
        assert data['max_rounds'] == 6
        assert data['max_players'] == 64
        assert data['buyin_type'] == 'TOKEN'
        # commit called twice: once for tournament insert, once for bracket_rounds
        assert mock_conn.commit.call_count == 2
        mock_conn.close.assert_called_once()

    def test_create_missing_name(self, client):
        """Missing name should return 400."""
        resp = client.post('/api/bracket/tournaments', json={
            'start_date': '2026-04-10',
        })
        assert resp.status_code == 400

    def test_create_missing_start_date(self, client):
        """Missing start_date should return 400."""
        resp = client.post('/api/bracket/tournaments', json={
            'name': 'No Date',
        })
        assert resp.status_code == 400

    @patch('routes.api.extract_fastbreak_runs')
    def test_create_no_classic_fbs(self, mock_fb_runs, client):
        """No Classic FBs found from start_date should return 400."""
        mock_fb_runs.return_value = [{
            'runName': 'Classic',
            'fastBreaks': [
                {'id': 'old', 'gameDate': '2020-01-01T00:00:00Z',
                 'gamesStartAt': '2020-01-01T23:00:00Z', 'status': 'FAST_BREAK_FINISHED'}
            ]
        }]
        resp = client.post('/api/bracket/tournaments', json={
            'name': 'Future Only',
            'start_date': '2030-01-01',
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

        # First fetchone: tournament row (includes max_rounds as 10th, buyin_type, moment_filters)
        tournament_row = (1, 'Test Cup', 5.0, '$MVP', 9999999999, 'ACTIVE', 1, None, '2026-01-01', 3, 'TOKEN', None)
        participant_rows = [
            (1, '0xaaa', 'user1', 1, None),
            (2, '0xbbb', 'user2', 2, None),
        ]
        matchup_rows = [
            (1, 1, 0, '0xaaa', '0xbbb', None, None, None, None, None, None, None, None, 'PENDING'),
        ]
        round_schedule_rows = [
            (1, 'fb-abc', '2026-04-10', '125 PTS, 40 FGM'),
        ]

        cursor.fetchone.return_value = tournament_row
        cursor.fetchall.side_effect = [participant_rows, matchup_rows, round_schedule_rows]

        resp = client.get('/api/bracket/tournament/1')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data['name'] == 'Test Cup'
        assert data['buyin_type'] == 'TOKEN'
        assert data['moment_filters'] is None
        assert len(data['participants']) == 2
        assert data['total_rounds'] == 1
        assert '1' in data['round_schedule'] or 1 in data['round_schedule']
        sched = data['round_schedule'].get('1') or data['round_schedule'].get(1)
        assert sched['objectives'] == '125 PTS, 40 FGM'


class TestBracketSignup:
    """POST /api/bracket/tournament/<id>/signup"""

    @patch('routes.api.get_ts_username_from_flow_wallet', return_value='tsuser1')
    @patch('db.init.get_db_connection')
    def test_signup_success(self, mock_get_conn, mock_ts, client):
        db, cursor = _mock_db()
        mock_get_conn.return_value = (db, 'sqlite')

        import time
        future_ts = int(time.time()) + 3600
        # Tournament row (signup_close_ts, status, max_rounds, buyin_type)
        cursor.fetchone.side_effect = [
            (future_ts, 'SIGNUP', 3, 'TOKEN'),  # tournament check
            (0,),                                # participant count for max-players check
            None,                                # duplicate check (no existing)
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
        assert data['buyin_type'] == 'TOKEN'

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

        cursor.fetchone.return_value = (1000000, 'ACTIVE', 3, 'TOKEN')  # not SIGNUP

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

        # Tournament status, then bracket_rounds lookup
        cursor.fetchone.side_effect = [
            ('ACTIVE', 1),            # tournament status + current_round
            ('fb123',),               # bracket_rounds fastbreak_id for round 1
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

        resp = client.post('/api/bracket/tournament/1/advance')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data['success'] is True
        # With only 1 matchup, the single winner ends the tournament
        assert data['status'] == 'COMPLETE'

    @patch('db.init.get_db_connection')
    def test_advance_no_round_mapping(self, mock_get_conn, client):
        """Advance should fail if no bracket_rounds mapping exists."""
        db, cursor = _mock_db()
        mock_get_conn.return_value = (db, 'sqlite')

        cursor.fetchone.side_effect = [
            ('ACTIVE', 1),   # tournament status + current_round
            None,            # bracket_rounds lookup returns nothing
        ]

        resp = client.post('/api/bracket/tournament/1/advance')
        assert resp.status_code == 400
        assert 'No fastbreak mapped' in json.loads(resp.data)['error']

    @patch('db.init.get_db_connection')
    def test_advance_not_active(self, mock_get_conn, client):
        db, cursor = _mock_db()
        mock_get_conn.return_value = (db, 'sqlite')

        cursor.fetchone.return_value = ('SIGNUP', 0)

        resp = client.post('/api/bracket/tournament/1/advance')
        assert resp.status_code == 400


class TestCreateFreerollTournament:
    """POST /api/bracket/tournaments with buyin_type=FREEROLL"""

    @patch('routes.api.extract_fastbreak_runs')
    @patch('db.init.get_db_connection')
    def test_create_freeroll(self, mock_conn_fn, mock_fb_runs, client):
        """Create a freeroll tournament — fee should be 0."""
        mock_conn = Mock()
        mock_cursor = Mock()
        mock_conn.cursor.return_value = mock_cursor
        mock_cursor.fetchone.return_value = (50,)
        mock_conn_fn.return_value = (mock_conn, 'sqlite')

        mock_fb_runs.return_value = [{
            'runName': 'Classic',
            'fastBreaks': [
                {'id': f'fb{i}', 'gameDate': f'2026-04-{10+i:02d}T00:00:00Z',
                 'gamesStartAt': f'2026-04-{10+i:02d}T23:00:00Z', 'status': 'FAST_BREAK_SCHEDULED'}
                for i in range(3)
            ]
        }]

        resp = client.post('/api/bracket/tournaments', json={
            'name': 'Free Cup',
            'start_date': '2026-04-10',
            'buyin_type': 'FREEROLL',
            'max_rounds': 3,
        })
        assert resp.status_code == 201
        data = json.loads(resp.data)
        assert data['buyin_type'] == 'FREEROLL'
        assert data['name'] == 'Free Cup'
        # Verify insert was called with fee_amount=0 and empty currency
        insert_call = mock_cursor.execute.call_args_list[0]
        insert_args = insert_call[0][1]
        assert insert_args[1] == 0       # fee_amount
        assert insert_args[2] == ''      # fee_currency
        assert insert_args[3] == 'FREEROLL'  # buyin_type


class TestCreateMomentTournament:
    """POST /api/bracket/tournaments with buyin_type=MOMENT"""

    @patch('routes.api.extract_fastbreak_runs')
    @patch('db.init.get_db_connection')
    def test_create_moment_buyin(self, mock_conn_fn, mock_fb_runs, client):
        """Create a moment buy-in tournament with valid filters."""
        mock_conn = Mock()
        mock_cursor = Mock()
        mock_conn.cursor.return_value = mock_cursor
        mock_cursor.fetchone.return_value = (99,)
        mock_conn_fn.return_value = (mock_conn, 'sqlite')

        mock_fb_runs.return_value = [{
            'runName': 'Classic',
            'fastBreaks': [
                {'id': f'fb{i}', 'gameDate': f'2026-04-{10+i:02d}T00:00:00Z',
                 'gamesStartAt': f'2026-04-{10+i:02d}T23:00:00Z', 'status': 'FAST_BREAK_SCHEDULED'}
                for i in range(3)
            ]
        }]

        resp = client.post('/api/bracket/tournaments', json={
            'name': 'Curry Rare Cup',
            'start_date': '2026-04-10',
            'buyin_type': 'MOMENT',
            'moment_filters': {'tier': 'RARE', 'player_name': 'Stephen Curry', 'series': '8'},
            'max_rounds': 3,
        })
        assert resp.status_code == 201
        data = json.loads(resp.data)
        assert data['buyin_type'] == 'MOMENT'
        # Verify moment_filters was stored in the insert
        insert_call = mock_cursor.execute.call_args_list[0]
        insert_args = insert_call[0][1]
        assert insert_args[3] == 'MOMENT'  # buyin_type
        stored_filters = json.loads(insert_args[4])  # moment_filters
        assert stored_filters['tier'] == 'RARE'
        assert stored_filters['player_name'] == 'Stephen Curry'
        assert stored_filters['series'] == '8'

    def test_create_moment_missing_filters(self, client):
        """MOMENT buy-in without moment_filters should return 400."""
        resp = client.post('/api/bracket/tournaments', json={
            'name': 'No Filters',
            'start_date': '2026-04-10',
            'buyin_type': 'MOMENT',
        })
        assert resp.status_code == 400
        assert 'moment_filters' in json.loads(resp.data)['error']

    def test_create_moment_empty_filters(self, client):
        """MOMENT buy-in with empty moment_filters should return 400."""
        resp = client.post('/api/bracket/tournaments', json={
            'name': 'Empty Filters',
            'start_date': '2026-04-10',
            'buyin_type': 'MOMENT',
            'moment_filters': {},
        })
        assert resp.status_code == 400

    def test_create_invalid_buyin_type(self, client):
        """Invalid buyin_type should return 400."""
        resp = client.post('/api/bracket/tournaments', json={
            'name': 'Bad Type',
            'start_date': '2026-04-10',
            'buyin_type': 'INVALID',
        })
        assert resp.status_code == 400
        assert 'buyin_type' in json.loads(resp.data)['error']


class TestFreerollSignup:
    """POST /api/bracket/tournament/<id>/signup for FREEROLL tournaments"""

    @patch('routes.api.get_ts_username_from_flow_wallet', return_value='freeuser1')
    @patch('db.init.get_db_connection')
    def test_signup_freeroll(self, mock_get_conn, mock_ts, client):
        """Freeroll signup should succeed without any payment."""
        db, cursor = _mock_db()
        mock_get_conn.return_value = (db, 'sqlite')

        import time
        future_ts = int(time.time()) + 3600
        cursor.fetchone.side_effect = [
            (future_ts, 'SIGNUP', 3, 'FREEROLL'),  # tournament check
            (0,),                                    # participant count
            None,                                    # duplicate check
        ]

        resp = client.post(
            '/api/bracket/tournament/1/signup',
            data=json.dumps({'wallet': '0xFreePlayer'}),
            content_type='application/json',
        )
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data['success'] is True
        assert data['ts_username'] == 'freeuser1'
        assert data['buyin_type'] == 'FREEROLL'


class TestMomentSignup:
    """POST /api/bracket/tournament/<id>/signup for MOMENT tournaments"""

    @patch('routes.api.get_ts_username_from_flow_wallet', return_value='momentuser1')
    @patch('db.init.get_db_connection')
    def test_signup_moment(self, mock_get_conn, mock_ts, client):
        """Moment signup should succeed when wallet resolves to a username."""
        db, cursor = _mock_db()
        mock_get_conn.return_value = (db, 'sqlite')

        import time
        future_ts = int(time.time()) + 3600
        cursor.fetchone.side_effect = [
            (future_ts, 'SIGNUP', 3, 'MOMENT'),  # tournament check
            (0,),                                  # participant count
            None,                                  # duplicate check
        ]

        resp = client.post(
            '/api/bracket/tournament/1/signup',
            data=json.dumps({'wallet': '0xMomentPlayer'}),
            content_type='application/json',
        )
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data['success'] is True
        assert data['ts_username'] == 'momentuser1'
        assert data['buyin_type'] == 'MOMENT'


class TestListTournamentsWithBuyinTypes:
    """GET /api/bracket/tournaments — verify all buy-in types are returned."""

    @patch('routes.api.get_db')
    def test_mixed_buyin_types(self, mock_get_db, client):
        db, cursor = _mock_db()
        mock_get_db.return_value = db

        token_row = (1, 'Token Cup', 10.0, '$MVP', 9999999999, 'SIGNUP', 0, None, '2026-01-01', 3, 'TOKEN', None)
        freeroll_row = (2, 'Free Cup', 0.0, '', 9999999999, 'SIGNUP', 0, None, '2026-01-02', 3, 'FREEROLL', None)
        moment_row = (3, 'Moment Cup', 0.0, '', 9999999999, 'SIGNUP', 0, None, '2026-01-03', 3, 'MOMENT',
                      json.dumps({'tier': 'RARE', 'player_name': 'Stephen Curry'}))

        cursor.fetchall.side_effect = [
            [token_row, freeroll_row, moment_row],
        ]
        cursor.fetchone.return_value = (5,)  # participant count for each

        resp = client.get('/api/bracket/tournaments')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert len(data) == 3
        assert data[0]['buyin_type'] == 'TOKEN'
        assert data[0]['moment_filters'] is None
        assert data[1]['buyin_type'] == 'FREEROLL'
        assert data[2]['buyin_type'] == 'MOMENT'
        assert data[2]['moment_filters']['tier'] == 'RARE'
        assert data[2]['moment_filters']['player_name'] == 'Stephen Curry'


class TestGetTournamentDetailBuyinTypes:
    """GET /api/bracket/tournament/<id> — verify buyin_type and moment_filters."""

    @patch('routes.api.get_db')
    def test_moment_detail(self, mock_get_db, client):
        db, cursor = _mock_db()
        mock_get_db.return_value = db

        tournament_row = (1, 'Moment Cup', 0.0, '', 9999999999, 'SIGNUP', 0, None, '2026-01-01', 3,
                          'MOMENT', json.dumps({'tier': 'RARE', 'player_name': 'Stephen Curry', 'series': '8'}))
        cursor.fetchone.return_value = tournament_row
        cursor.fetchall.side_effect = [[], [], []]  # participants, matchups, round_schedule

        resp = client.get('/api/bracket/tournament/1')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data['buyin_type'] == 'MOMENT'
        assert data['moment_filters']['tier'] == 'RARE'
        assert data['moment_filters']['player_name'] == 'Stephen Curry'
        assert data['moment_filters']['series'] == '8'

    @patch('routes.api.get_db')
    def test_freeroll_detail(self, mock_get_db, client):
        db, cursor = _mock_db()
        mock_get_db.return_value = db

        tournament_row = (2, 'Free Cup', 0.0, '', 9999999999, 'SIGNUP', 0, None, '2026-01-01', 3,
                          'FREEROLL', None)
        cursor.fetchone.return_value = tournament_row
        cursor.fetchall.side_effect = [[], [], []]

        resp = client.get('/api/bracket/tournament/2')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data['buyin_type'] == 'FREEROLL'
        assert data['moment_filters'] is None