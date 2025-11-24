"""Integration tests for main application."""

import pytest
from unittest.mock import Mock, patch, MagicMock


class TestApplicationStartup:
    """Test that the main application can start successfully."""

    def test_imports_work(self):
        """Test that core modules can be imported."""
        # Test individual module imports
        try:
            import config
            assert hasattr(config, 'FLASK_HOST')
        except ImportError as e:
            pytest.fail(f"Failed to import config: {e}")

    def test_database_initialization(self):
        """Test that database module has required functions."""
        try:
            from db.init import get_db_connection, initialize_database
            assert callable(get_db_connection)
            assert callable(initialize_database)
        except Exception as e:
            pytest.fail(f"Database module check failed: {e}")

    def test_flask_app_creation(self):
        """Test that routes module can be imported."""
        try:
            from routes.api import register_routes
            assert callable(register_routes)
        except Exception as e:
            pytest.fail(f"Routes module check failed: {e}")

    def test_discord_bot_creation(self):
        """Test that bot.commands module exists."""
        import importlib.util
        spec = importlib.util.find_spec('bot.commands')
        assert spec is not None, "bot.commands module not found"


class TestModuleStructure:
    """Test that module structure is correct."""

    def test_config_module_exists(self):
        """Test that config module can be imported."""
        try:
            import config
            assert hasattr(config, 'FLASK_HOST')
            assert hasattr(config, 'FLASK_PORT')
        except ImportError as e:
            pytest.fail(f"Failed to import config module: {e}")

    def test_routes_module_exists(self):
        """Test that routes module can be imported."""
        try:
            from routes import api
            assert hasattr(api, 'register_routes')
        except ImportError as e:
            pytest.fail(f"Failed to import routes module: {e}")

    def test_bot_module_exists(self):
        """Test that bot.commands module exists."""
        import importlib.util
        spec = importlib.util.find_spec('bot.commands')
        assert spec is not None, "bot.commands module not found"

    def test_db_module_exists(self):
        """Test that db module can be imported."""
        try:
            from db import init
            assert hasattr(init, 'get_db_connection')
            assert hasattr(init, 'initialize_database')
        except ImportError as e:
            pytest.fail(f"Failed to import db module: {e}")

    def test_utils_module_exists(self):
        """Test that utils module can be imported."""
        try:
            from utils import helpers
            assert hasattr(helpers, 'prepare_query')
        except ImportError as e:
            pytest.fail(f"Failed to import utils module: {e}")


class TestEnvironmentConfiguration:
    """Test environment-based configuration."""

    def test_postgresql_mode_when_database_url_set(self):
        """Test that PostgreSQL mode is used when DATABASE_URL is set."""
        import os
        # Save original value
        original_value = os.environ.get('DATABASE_URL')
        
        try:
            # Set test value
            os.environ['DATABASE_URL'] = 'postgresql://test'
            
            # Re-import config to pick up new value
            import importlib
            import config
            importlib.reload(config)
            
            # Check the value was picked up
            assert config.DATABASE_URL == 'postgresql://test'
        finally:
            # Restore original value
            if original_value is None:
                os.environ.pop('DATABASE_URL', None)
            else:
                os.environ['DATABASE_URL'] = original_value
            # Reload config again to restore state
            import config
            importlib.reload(config)

    def test_sqlite_mode_when_database_url_not_set(self):
        """Test that SQLite mode is used when DATABASE_URL is not set."""
        import os
        # Save original value
        original_value = os.environ.get('DATABASE_URL')
        
        try:
            # Remove DATABASE_URL
            os.environ.pop('DATABASE_URL', None)
            
            # Re-import to get fresh config
            import importlib
            import config
            importlib.reload(config)
            
            # Should be None when not set
            assert config.DATABASE_URL is None
        finally:
            # Restore original value
            if original_value is not None:
                os.environ['DATABASE_URL'] = original_value
            # Reload config again to restore state
            import config
            importlib.reload(config)
