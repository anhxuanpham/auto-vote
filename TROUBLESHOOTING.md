# Troubleshooting Guide

Comprehensive debugging guide for TopGG Auto Vote Service.

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Common Issues](#common-issues)
3. [Authentication Problems](#authentication-problems)
4. [Browser Issues](#browser-issues)
5. [Docker Issues](#docker-issues)
6. [Voting Failures](#voting-failures)
7. [Performance Issues](#performance-issues)
8. [Debugging Tools](#debugging-tools)

---

## Quick Diagnostics

### Health Check Commands

```bash
# Check container status
docker-compose ps

# View recent logs
docker-compose logs --tail=50

# Check for errors
docker-compose logs | grep -i error

# Verify state file
cat data/vote-state.json

# Check disk space
df -h

# Check memory usage
docker stats
```

### Log Patterns to Watch

```
✓ SUCCESS: "Vote successful"
✗ ERROR: "Vote failed"
✗ ERROR: "Authentication failed"
✗ ERROR: "Browser launch failed"
⚠ WARN:  "Consecutive failures"
```

---

## Common Issues

### Issue: Container Won't Start

**Symptoms:**
- `docker-compose up` fails immediately
- Container exits with code 1
- No logs visible

**Diagnosis:**

```bash
# Check Docker daemon
docker info

# Check environment file syntax
cat config/docker.env

# View error details
docker-compose logs
```

**Solutions:**

1. **Fix environment file syntax:**
   ```bash
   # No quotes around values
   # Correct: DISCORD_TOKENS=token1,token2
   # Wrong: DISCORD_TOKENS="token1,token2"

   # No trailing spaces
   # Use Unix line endings (LF), not Windows (CRLF)
   ```

2. **Check Docker daemon:**
   ```bash
   # Restart Docker
   sudo systemctl restart docker  # Linux
   # Or restart Docker Desktop
   ```

3. **Rebuild without cache:**
   ```bash
   docker-compose build --no-cache
   docker-compose up -d
   ```

4. **Verify volume directories:**
   ```bash
   mkdir -p data logs screenshots
   chmod 755 data logs screenshots
   ```

---

### Issue: Vote Fails with "Token Invalid"

**Symptoms:**
- Logs show "Invalid Discord token"
- Authentication fails immediately
- Token rejected by Discord

**Diagnosis:**

```bash
# Check token format
docker-compose logs | grep -i token

# Verify environment variable
docker-compose exec topgg-vote printenv | grep DISCORD_TOKENS
```

**Solutions:**

1. **Verify token format:**
   - Token should be long alphanumeric string
   - Usually starts with user-specific prefix
   - No extra spaces or newlines

2. **Check token extraction method:**
   ```javascript
   // In browser console:
   localStorage.getItem('token')
   // OR
   //=(await webpackChunkdiscord_app.push([[Symbol()],{},e=>{m=[];for(let c in e.c)m.push(e.c[c])}]),m).find(m=>m.exports?.default?.getToken!==void 0).exports.default.getToken()
   ```

3. **Test token validity:**
   - Login to Discord with token
   - Check if account is locked/verified
   - Ensure 2FA doesn't interfere

4. **Regenerate token:**
   - Logout and login to Discord
   - Extract new token
   - Update .env file
   - Restart container

---

### Issue: Browser Crashes

**Symptoms:**
- "Chrome crashed" in logs
- Container restarts repeatedly
- Vote fails mid-execution

**Diagnosis:**

```bash
# Check crash logs
docker-compose logs | grep -i "crash\|chrome\|error"

# Check memory
docker stats topgg-vote

# Check disk space
df -h
```

**Solutions:**

1. **Increase memory limit:**
   ```yaml
   # In docker-compose.yml:
   services:
     topgg-vote:
       deploy:
         resources:
           limits:
             memory: 2G  # Increase from 1G
   ```

2. **Add Chrome flags:**
   ```yaml
   environment:
     - PUPPETEER_ARGS=--no-sandbox,--disable-dev-shm-usage,--disable-gpu
   ```

3. **Check disk space:**
   ```bash
   # Clean up if >80% full
   docker system prune -a
   ```

4. **Disable hardware acceleration:**
   ```yaml
   environment:
     - PUPPETEER_ARGS=--disable-dev-shm-usage,--disable-software-rasterizer
   ```

---

## Authentication Problems

### Issue: Discord Login Fails

**Symptoms:**
- Stuck on login page
- "Authentication timeout"
- Screenshot shows login form

**Diagnosis:**

```bash
# Check authentication logs
docker-compose logs | grep -i "auth\|login"

# View screenshot
ls -lh screenshots/
```

**Solutions:**

1. **Verify token is for correct account type:**
   - Use user account token, NOT bot token
   - Token should be from regular Discord login

2. **Check account status:**
   - Account must be verified
   - Not locked/banned
   - Phone verified if required

3. **Run with visible browser:**
   ```yaml
   # In docker.env:
   HEADLESS=false
   ```

4. **Check for CAPTCHA:**
   - Login may require CAPTCHA
   - Screenshots show CAPTCHA challenge
   - May need manual intervention

---

### Issue: Cloudflare Detection

**Symptoms:**
- "Cloudflare challenge detected"
- Turnstile CAPTCHA appears
- Vote fails after timeout

**Diagnosis:**

```bash
# Check for Cloudflare logs
docker-compose logs | grep -i "cloudflare\|turnstile"

# View error screenshot
cat screenshots/error-*.png
```

**Solutions:**

1. **Wait for timeout:**
   - Service retries automatically
   - Next scheduled vote may succeed

2. **Use different IP:**
   - Change proxy if using one
   - Rotate through different tokens

3. **Consider CAPTCHA solving service:**
   - Captchaly (partially supported)
   - 2Captcha
   - Anti-Captcha

4. **Manual intervention:**
   - Run with HEADLESS=false
   - Solve CAPTCHA manually
   - Restart service

---

## Browser Issues

### Issue: Chrome/Chromium Not Found

**Symptoms:**
- "Failed to launch browser"
- "Executable not found"
- Container exits during browser launch

**Diagnosis:**

```bash
# Check Chrome installation
docker-compose exec topgg-vote which google-chrome
docker-compose exec topgg-vote which chromium

# Check Puppeteer logs
docker-compose logs | grep -i "puppeteer\|browser"
```

**Solutions:**

1. **Verify Dockerfile installs Chrome:**
   ```dockerfile
   RUN apt-get update && apt-get install -y \
       chromium \
       chromium-driver
   ```

2. **Set PUPPETEER_EXECUTABLE_PATH:**
   ```yaml
   environment:
     - PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
   ```

3. **Rebuild image:**
   ```bash
   docker-compose build --no-cache
   ```

---

### Issue: Browser Launch Timeout

**Symptoms:**
- "Browser launch timeout"
- Takes >30 seconds to start
- Eventually crashes

**Diagnosis:**

```bash
# Check startup logs
docker-compose logs | grep -i "launch\|timeout"

# Check system resources
docker stats
```

**Solutions:**

1. **Increase launch timeout:**
   ```typescript
   // In BrowserService.ts:
   await browser.launch({ timeout: 60000 });
   ```

2. **Reduce resource usage:**
   ```yaml
   environment:
     - PUPPETEER_ARGS=--single-process,--no-zygote
   ```

3. **Check system load:**
   ```bash
   # Stop other containers
   docker-compose down

   # Restart with more resources
   docker-compose up -d
   ```

---

## Docker Issues

### Issue: Permission Denied on Volumes

**Symptoms:**
- "EACCES: permission denied"
- Cannot write to data/logs/screenshots
- State file not created

**Diagnosis:**

```bash
# Check permissions
ls -la data logs screenshots

# Check container user
docker-compose exec topgg-vote id
```

**Solutions:**

1. **Fix directory permissions:**
   ```bash
   chmod 755 data logs screenshots
   chown -R $USER:$USER data logs screenshots
   ```

2. **Run as specific user:**
   ```yaml
   # In docker-compose.yml:
   user: "${UID}:${GID}"
   ```

3. **Use named volumes:**
   ```yaml
   volumes:
     - vote-data:/app/data
     - vote-logs:/app/logs
   ```

---

### Issue: Container Restarts Continuously

**Symptoms:**
- Container status shows "Restarting"
- Never stays up
- Logs show crash on startup

**Diagnosis:**

```bash
# Check restart count
docker-compose ps

# View crash logs
docker-compose logs --tail=100

# Check health status
docker inspect topgg-vote | jq '.[0].State.Health'
```

**Solutions:**

1. **Remove restart policy temporarily:**
   ```yaml
   # In docker-compose.yml:
   restart: "no"  # Change from "always"
   ```

2. **Run in foreground to see errors:**
   ```bash
   docker-compose up
   # (not -d)
   ```

3. **Check for memory issues:**
   ```bash
   # Increase limit
   docker-compose down
   # Edit docker-compose.yml
   docker-compose up -d
   ```

---

## Voting Failures

### Issue: Vote Not Submitted

**Symptoms:**
- Browser opens successfully
- Authentication works
- Vote button not clicked
- Timeout on voting page

**Diagnosis:**

```bash
# Check vote service logs
docker-compose logs | grep -i "vote\|submit"

# View screenshot
ls -lh screenshots/*.png
```

**Solutions:**

1. **Check selectors:**
   - TopGG may have changed HTML structure
   - Vote button selector might be outdated
   - Inspect page manually

2. **Increase wait time:**
   ```typescript
   // In VoteService.ts:
   await page.waitForSelector('button', { timeout: 30000 });
   ```

3. **Run headful for inspection:**
   ```yaml
   HEADLESS=false
   ```

4. **Check bot ID:**
   - Verify TOPGG_BOT_ID is correct
   - Test vote URL manually in browser

---

### Issue: State File Corruption

**Symptoms:**
- "Invalid JSON" in logs
- State manager fails to load
- Next vote time is invalid

**Diagnosis:**

```bash
# Check JSON validity
cat data/vote-state.json | jq '.'

# View raw file
cat data/vote-state.json
```

**Solutions:**

1. **Backup and remove state:**
   ```bash
   docker-compose down
   mv data/vote-state.json data/vote-state.json.backup
   docker-compose up -d
   # New state will be created
   ```

2. **Manual fix JSON:**
   ```bash
   # If JSON is malformed but recoverable
   nano data/vote-state.json
   # Fix syntax errors
   ```

3. **Reset vote schedule:**
   ```bash
   # Delete state file
   rm data/vote-state.json
   docker-compose restart
   ```

---

## Performance Issues

### Issue: High Memory Usage

**Symptoms:**
- Container uses >1GB RAM
- System slows down
- OOM kills

**Diagnosis:**

```bash
# Check memory usage
docker stats topgg-vote

# Check Chrome processes
docker-compose exec topgg-vote ps aux | grep chrome
```

**Solutions:**

1. **Set memory limits:**
   ```yaml
   deploy:
     resources:
       limits:
         memory: 1G
   ```

2. **Optimize Chrome flags:**
   ```yaml
   environment:
     - PUPPETEER_ARGS=--disable-dev-shm-usage,--disable-gpu,--single-process
   ```

3. **Close browser after vote:**
   ```typescript
   // Ensure browser.close() is called
   await browserService.close();
   ```

---

### Issue: Disk Space Exhaustion

**Symptoms:**
- Logs directory too large
- Screenshots accumulate
- Disk full errors

**Diagnosis:**

```bash
# Check disk usage
du -sh logs/ screenshots/

# Count files
find logs/ -type f | wc -l
find screenshots/ -type f | wc -l
```

**Solutions:**

1. **Enable log rotation:**
   ```yaml
   logging:
     driver: 'json-file'
     options:
       max-size: '10m'
       max-file: '5'
   ```

2. **Clean old screenshots:**
   ```bash
   # Delete screenshots older than 7 days
   find screenshots/ -name "*.png" -mtime +7 -delete
   ```

3. **Archive old logs:**
   ```bash
   # Compress logs older than 30 days
   find logs/ -name "*.log" -mtime +30 -exec gzip {} \;
   ```

4. **Set up cron job for cleanup:**
   ```bash
   # Add to crontab:
   0 0 * * * find /path/to/screenshots -name "*.png" -mtime +7 -delete
   0 0 * * * find /path/to/logs -name "*.log" -mtime +30 -exec gzip {} \;
   ```

---

## Debugging Tools

### Manual Vote Testing

```bash
# Run single vote for testing
npm run build
npm run test:manual
```

### Visual Debugging

```yaml
# In docker.env:
HEADLESS=false
```

Then watch browser session via VNC or X11.

### Log Analysis

```bash
# Find all errors
docker-compose logs | grep -i error

# Count vote successes
docker-compose logs | grep -c "Vote successful"

# View authentication flow
docker-compose logs | grep -i "auth\|login\|token"

# Check browser operations
docker-compose logs | grep -i "browser\|page\|click"
```

### State Inspection

```bash
# View state nicely formatted
cat data/vote-state.json | jq '.'

# Check next vote time
cat data/vote-state.json | jq '.nextVoteTime'

# Check failure count
cat data/vote-state.json | jq '.consecutiveFailures'

# View vote history
cat data/vote-state.json | jq '.lastVoteTime'
```

### Screenshot Analysis

```bash
# List all screenshots
ls -lh screenshots/

# View latest error screenshot
cat screenshots/error-$(ls screenshots/ | grep error | tail -1 | sed 's/error-//' | sed 's/.png//').png
```

### Network Debugging

```bash
# Check DNS resolution
docker-compose exec topgg-vote nslookup top.gg

# Test connectivity
docker-compose exec topgg-vote curl -I https://top.gg

# Check proxy (if used)
docker-compose exec topgg-vote env | grep -i proxy
```

---

## Getting Help

If issues persist after trying these solutions:

1. **Collect diagnostic information:**
   ```bash
   # Save logs
   docker-compose logs > diagnostics.log

   # Save state
   cat data/vote-state.json > diagnostics-state.json

   # List screenshots
   ls -lh screenshots/ > diagnostics-files.txt
   ```

2. **Check documentation:**
   - [README.md](README.md) - Usage and setup
   - [DOCKER.md](DOCKER.md) - Docker deployment

3. **Report issue with:**
   - Full error message
   - Logs snippet
   - Configuration (sanitized)
   - Steps to reproduce

---

## Prevention

### Best Practices

1. **Monitor regularly:**
   - Check logs daily
   - Review vote count weekly
   - Monitor disk space

2. **Keep tokens fresh:**
   - Rotate tokens monthly
   - Test tokens before deployment
   - Keep backup tokens

3. **Maintain system:**
   - Update dependencies
   - Clean old logs/screenshots
   - Monitor resource usage

4. **Test changes:**
   - Run in dev mode first
   - Test with single token
   - Verify before scaling

---

## Quick Reference

```bash
# Most common commands
make logs              # View logs
make ps                # Check status
make rebuild           # Rebuild and restart
make shell             # Debug inside container

# Emergency commands
docker-compose down    # Stop everything
docker system prune -a # Clean up Docker
rm data/vote-state.json # Reset state

# Monitoring
watch -n 5 'docker-compose ps'  # Watch status
tail -f logs/combined-*.log     # Watch logs
```

---

**Remember**: Most issues are related to invalid tokens, Cloudflare challenges, or resource limits. Start diagnostics there!
