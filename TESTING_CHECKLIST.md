# Testing Checklist for Reorganized Code

## Files Created
- ✅ `main.py` - New entry point
- ✅ `config.py` - Configuration constants
- ✅ `bot/commands.py` - Discord commands
- ✅ `bot/__init__.py` - Bot module init
- ✅ `routes/api.py` - Flask API routes
- ✅ `routes/__init__.py` - Routes module init
- ✅ `db/init.py` - Database initialization
- ✅ `REORGANIZATION.md` - Documentation

## Files Modified
- ✅ `Procfile` - Updated to use `main.py`

## Files Backed Up
- ✅ `jokicguess.py` → `jokicguess_backup.py`

## Pre-Deployment Testing

### Local Testing Steps

1. **Environment Setup**
   ```bash
   # Ensure all dependencies are installed
   pip install -r requirements.txt
   ```

2. **Database Connectivity**
   - [ ] Verify local.db is accessible (SQLite mode)
   - [ ] Test PostgreSQL connection if DATABASE_URL is set

3. **Flask API Endpoints**
   Test these endpoints are working:
   - [ ] `GET /` (React app serves)
   - [ ] `GET /api/leaderboard`
   - [ ] `GET /api/treasury`
   - [ ] `GET /api/fastbreak/contests`
   - [ ] `GET /api/fastbreak_racing_stats`
   - [ ] `GET /api/fastbreak_racing_usernames`

4. **Discord Bot Commands**
   Test these commands in Discord:
   - [ ] `/start` (admin)
   - [ ] `/predict`
   - [ ] `/predictions`
   - [ ] `/my_predictions`
   - [ ] `/pet`
   - [ ] `/pet_all`
   - [ ] `/my_rewards`
   - [ ] `/claim`
   - [ ] `/gift_leaderboard`
   - [ ] `/create_fastbreak_contest` (admin)
   - [ ] `/pull_fastbreak_horse_stats` (admin)

5. **Database Operations**
   - [ ] Predictions are saved correctly
   - [ ] Petting rewards are tracked
   - [ ] FastBreak entries are recorded
   - [ ] Gifts are logged

6. **Swapfest Scraper**
   - [ ] Verify swapfest.main() task starts
   - [ ] Check blockchain scraping is working

## Common Issues & Solutions

### Import Errors
If you see `ModuleNotFoundError`:
- Ensure `bot/__init__.py` and `routes/__init__.py` exist
- Check Python is running from the project root
- Verify PYTHONPATH includes the project directory

### Database Connection Issues
If database errors occur:
- Check DATABASE_URL environment variable
- Verify local.db exists for SQLite mode
- Ensure PostgreSQL credentials are correct

### Flask Not Starting
If Flask server doesn't start:
- Check port 8000 is not already in use
- Verify FLASK_HOST and FLASK_PORT in config.py
- Check firewall settings

### Discord Bot Not Connecting
If bot doesn't come online:
- Verify DISCORD_TOKEN environment variable
- Check secret.txt file exists with valid token
- Ensure bot has proper intents enabled in Discord Developer Portal

## Rollback Plan

If critical issues arise:

1. Rename files back:
   ```bash
   mv jokicguess_backup.py jokicguess.py
   ```

2. Restore Procfile:
   ```
   worker: python jokicguess.py
   ```

3. Deploy original version

## Performance Verification

After deployment:
- [ ] Monitor response times for API endpoints
- [ ] Check Discord bot latency
- [ ] Verify memory usage is similar to original
- [ ] Monitor error logs for any new exceptions

## Success Criteria

✅ All API endpoints return correct data
✅ All Discord commands execute without errors  
✅ Database writes/reads work correctly
✅ No increase in memory/CPU usage
✅ Logs show no new errors or warnings
✅ Frontend React app loads and functions correctly

---

**Note**: The reorganization is purely structural. No business logic has changed, so all functionality should work identically to the original `jokicguess.py`.
