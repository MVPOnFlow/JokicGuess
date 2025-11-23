# JokicGuess Test Suite

Comprehensive unit tests for the JokicGuess application.

## Test Structure

```
tests/
├── __init__.py
├── conftest.py              # Shared fixtures and configuration
├── test_config.py           # Configuration module tests
├── test_db_init.py          # Database initialization tests
├── test_routes.py           # Flask API route tests
├── test_bot_commands.py     # Discord bot command tests
└── test_helpers.py          # Helper utility tests
```

## Running Tests

### Run all tests
```bash
pytest
```

### Run with coverage report
```bash
pytest --cov=. --cov-report=html
```

### Run specific test file
```bash
pytest tests/test_routes.py
```

### Run specific test class
```bash
pytest tests/test_routes.py::TestLeaderboardAPI
```

### Run specific test function
```bash
pytest tests/test_routes.py::TestLeaderboardAPI::test_api_leaderboard_returns_json
```

### Run with verbose output
```bash
pytest -v
```

### Run tests in parallel (faster)
```bash
pip install pytest-xdist
pytest -n auto
```

## Test Coverage

Current test coverage includes:

- ✅ **Configuration** (`test_config.py`)
  - Environment variable handling
  - Constant validation
  - Configuration format checking

- ✅ **Database** (`test_db_init.py`)
  - Connection creation (SQLite/PostgreSQL)
  - Schema initialization
  - Table creation
  - View/materialized view creation

- ✅ **API Routes** (`test_routes.py`)
  - React SPA routing
  - Leaderboard endpoint
  - Treasury endpoint
  - FastBreak contest endpoints
  - Entry management
  - Error handling

- ✅ **Bot Commands** (`test_bot_commands.py`)
  - Command registration
  - Permission validation
  - Channel restrictions
  - Admin-only commands

- ✅ **Helpers** (`test_helpers.py`)
  - Query preparation
  - Wallet mapping
  - Reward generation
  - Contest management

## Fixtures

Common fixtures available in `conftest.py`:

- `mock_env_vars` - Mocked environment variables
- `mock_database` - Mock database connection and cursor
- `sample_predictions` - Sample prediction data
- `sample_gifts` - Sample gift transaction data
- `sample_fastbreak_entries` - Sample FastBreak entries

## Writing New Tests

### Example test structure:

```python
import pytest
from unittest.mock import Mock, patch

class TestMyFeature:
    """Test my new feature."""

    @pytest.fixture
    def setup_data(self):
        """Fixture for test data."""
        return {"key": "value"}

    def test_feature_works(self, setup_data):
        """Test that feature works as expected."""
        # Arrange
        expected = "value"
        
        # Act
        result = setup_data["key"]
        
        # Assert
        assert result == expected
```

### Mocking database calls:

```python
@patch('routes.api.get_db')
def test_my_route(mock_get_db):
    mock_cursor = Mock()
    mock_db = Mock()
    mock_db.cursor.return_value = mock_cursor
    mock_get_db.return_value = mock_db
    
    mock_cursor.fetchall.return_value = [("data",)]
    
    # Test your route
```

### Testing async Discord commands:

```python
from unittest.mock import AsyncMock

@pytest.mark.asyncio
async def test_discord_command():
    interaction = AsyncMock()
    interaction.response = AsyncMock()
    
    # Test your command
```

## CI/CD Integration

Tests run automatically on:

- ✅ Every push to `main` branch
- ✅ Every pull request
- ✅ Before deployment to Azure

See `.github/workflows/test.yml` for CI configuration.

## Coverage Reports

After running tests with coverage:

```bash
pytest --cov=. --cov-report=html
```

Open `htmlcov/index.html` in your browser to view detailed coverage report.

## Best Practices

1. **Test one thing per test** - Each test should verify a single behavior
2. **Use descriptive names** - Test names should describe what they test
3. **Arrange-Act-Assert** - Structure tests clearly
4. **Mock external dependencies** - Don't hit real databases or APIs
5. **Test edge cases** - Include tests for error conditions
6. **Keep tests fast** - Use mocks to avoid slow operations

## Troubleshooting

### Import errors
Ensure you're running pytest from the project root:
```bash
cd /path/to/JokicGuess
pytest
```

### Database errors in tests
Tests use SQLite by default. If you see PostgreSQL errors, check that `DATABASE_URL` is not set in your test environment.

### Async test errors
Install `pytest-asyncio`:
```bash
pip install pytest-asyncio
```

## Contributing

When adding new features:

1. Write tests first (TDD approach recommended)
2. Ensure all tests pass: `pytest`
3. Check coverage: `pytest --cov=. --cov-report=term-missing`
4. Aim for >80% coverage on new code
