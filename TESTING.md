# Testing Guide

## Quick Start

### Install test dependencies
```bash
pip install -r requirements-dev.txt
```

### Run all tests
```bash
pytest
```

### Run with coverage
```bash
pytest --cov=. --cov-report=html
open htmlcov/index.html  # View coverage report
```

## Test Organization

```
tests/
├── test_config.py           # Configuration tests
├── test_db_init.py          # Database initialization tests
├── test_routes.py           # Flask API endpoint tests
├── test_bot_commands.py     # Discord command tests
├── test_helpers.py          # Utility function tests
├── test_integration.py      # Integration tests
├── conftest.py             # Shared fixtures
└── README.md               # Detailed testing documentation
```

## What's Tested

### ✅ Configuration (`test_config.py`)
- Environment variables
- Constant validation
- Time format validation
- Channel ID validation

### ✅ Database (`test_db_init.py`)
- SQLite connection
- PostgreSQL connection
- Table creation
- View creation
- Constraint handling

### ✅ API Routes (`test_routes.py`)
- Leaderboard endpoint
- Treasury endpoint
- FastBreak contests
- Entry management
- Error handling
- React SPA routing

### ✅ Bot Commands (`test_bot_commands.py`)
- Command registration
- Permission checks
- Channel restrictions
- Admin validations

### ✅ Helpers (`test_helpers.py`)
- Query preparation
- Wallet mapping
- Reward generation
- Contest management

### ✅ Integration (`test_integration.py`)
- Module imports
- Application startup
- Database initialization
- Environment configuration

## CI/CD Integration

### GitHub Actions Workflows

**1. Test Workflow** (`.github/workflows/test.yml`)
- Runs on: Push to main/develop, Pull Requests
- Tests on: Python 3.11, 3.12, 3.13
- Includes: Linting with flake8, black, isort
- Uploads: Coverage to Codecov

**2. Deploy Workflow** (`.github/workflows/azure-deploy.yml`)
- Runs on: Push to main
- Steps:
  1. Build React frontend
  2. Install Python dependencies
  3. **Run unit tests** ← NEW
  4. Upload coverage
  5. Deploy to Azure (only if tests pass)

## Running Tests Locally

### Run specific test file
```bash
pytest tests/test_routes.py -v
```

### Run specific test class
```bash
pytest tests/test_routes.py::TestLeaderboardAPI -v
```

### Run with markers
```bash
pytest -m unit          # Run only unit tests
pytest -m integration   # Run only integration tests
```

### Run in parallel (faster)
```bash
pytest -n auto
```

### Run with detailed output
```bash
pytest -vv
```

### Stop on first failure
```bash
pytest -x
```

## Coverage Goals

- **Overall**: 80%+ coverage
- **Critical paths**: 90%+ coverage
- **New features**: 100% coverage required

## Continuous Integration

Tests must pass before:
- ✅ Merging pull requests
- ✅ Deploying to production
- ✅ Creating releases

## Writing Tests

See `tests/README.md` for:
- Test structure guidelines
- Fixture usage
- Mocking examples
- Best practices

## Troubleshooting

### "ModuleNotFoundError"
```bash
# Run from project root
cd /path/to/JokicGuess
pytest
```

### "Import errors"
```bash
# Install dev dependencies
pip install -r requirements-dev.txt
```

### "Database errors"
```bash
# Ensure DATABASE_URL is not set for tests
unset DATABASE_URL
pytest
```

## Test Results

Check test results in:
- Terminal output
- `htmlcov/index.html` (coverage report)
- GitHub Actions workflow runs
- Codecov dashboard

## Next Steps

1. ✅ Run tests locally: `pytest`
2. ✅ Check coverage: `pytest --cov=.`
3. ✅ Fix any failures
4. ✅ Commit and push
5. ✅ Verify CI passes on GitHub
