"""Unit tests for database initialization module."""

import pytest
import sqlite3
from unittest.mock import Mock, patch, MagicMock
from db.init import get_db_connection, initialize_database


class TestDatabaseConnection:
    """Test database connection functionality."""

    @patch('db.init.DATABASE_URL', None)
    @patch('db.init.sqlite3.connect')
    def test_get_db_connection_sqlite(self, mock_connect):
        """Test SQLite connection creation."""
        mock_conn = Mock()
        mock_connect.return_value = mock_conn
        
        conn, db_type = get_db_connection()
        
        assert db_type == 'sqlite'
        mock_connect.assert_called_once_with('local.db', check_same_thread=False)

    @patch('db.init.DATABASE_URL', 'postgresql://test')
    @patch('db.init.psycopg2.connect')
    def test_get_db_connection_postgresql(self, mock_connect):
        """Test PostgreSQL connection creation."""
        mock_conn = Mock()
        mock_connect.return_value = mock_conn
        
        conn, db_type = get_db_connection()
        
        assert db_type == 'postgresql'
        mock_connect.assert_called_once_with('postgresql://test', sslmode='require')


class TestDatabaseInitialization:
    """Test database schema initialization."""

    def test_initialize_database_creates_tables(self):
        """Test that all required tables are created."""
        mock_conn = Mock()
        mock_cursor = Mock()
        mock_conn.cursor.return_value = mock_cursor
        
        cursor = initialize_database(mock_conn, 'sqlite')
        
        # Verify cursor was created
        assert cursor == mock_cursor
        
        # Verify execute was called multiple times for table creation
        assert mock_cursor.execute.call_count > 10
        
        # Verify commit was called
        assert mock_conn.commit.call_count > 10

    def test_initialize_database_sqlite_creates_views(self):
        """Test that SQLite views are created."""
        mock_conn = Mock()
        mock_cursor = Mock()
        mock_conn.cursor.return_value = mock_cursor
        
        initialize_database(mock_conn, 'sqlite')
        
        # Check that view creation SQL was executed
        execute_calls = [str(call) for call in mock_cursor.execute.call_args_list]
        view_created = any('CREATE VIEW' in str(call) for call in execute_calls)
        assert view_created

    def test_initialize_database_postgresql_creates_materialized_view(self):
        """Test that PostgreSQL materialized view is created."""
        mock_conn = Mock()
        mock_cursor = Mock()
        mock_conn.cursor.return_value = mock_cursor
        
        initialize_database(mock_conn, 'postgresql')
        
        # Check that materialized view creation SQL was executed
        execute_calls = [str(call) for call in mock_cursor.execute.call_args_list]
        mat_view_created = any('CREATE MATERIALIZED VIEW' in str(call) for call in execute_calls)
        assert mat_view_created

    def test_initialize_database_handles_constraint_error(self):
        """Test that constraint errors are handled gracefully."""
        mock_conn = Mock()
        mock_cursor = Mock()
        mock_conn.cursor.return_value = mock_cursor
        
        # Make the constraint addition fail
        def execute_side_effect(query, *args):
            if 'ADD CONSTRAINT' in query:
                raise Exception("Constraint already exists")
        
        mock_cursor.execute.side_effect = execute_side_effect
        
        # Should not raise an exception
        try:
            initialize_database(mock_conn, 'postgresql')
        except Exception:
            pytest.fail("initialize_database raised an exception unexpectedly")
