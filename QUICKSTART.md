# Quick Start Guide - Docker Deployment

## 1. Setup (5 minutes)

```bash
# Copy environment template
cp config/docker.env.example config/docker.env

# Edit configuration (REQUIRED: Add Discord tokens)
nano config/docker.env

# Create data directories
mkdir -p data logs screenshots
```

## 2. Build (5-10 minutes)

```bash
# Using Make (recommended)
make build

# Or using docker-compose
docker-compose build
```

## 3. Run (1 minute)

```bash
# Start container
make run

# View logs
make logs

# Stop container
make stop
```

## Environment Variables (Required)

Edit `config/docker.env`:

```env
# REQUIRED: Your Discord tokens (comma-separated)
DISCORD_TOKENS=your_token_here,another_token_here

# REQUIRED: Bot ID
TOPGG_BOT_ID=408785106942164992

# OPTIONAL: Scheduling
VOTE_INTERVAL_HOURS=12

# OPTIONAL: Logging
LOG_LEVEL=info
```

## Useful Commands

```bash
make build      # Build image
make run        # Start container
make logs       # View logs
make stop       # Stop container
make rebuild    # Rebuild and restart
make shell      # Shell into container
make ps         # Check status
```

## Troubleshooting

**Container won't start?**
```bash
docker-compose logs topgg-vote
```

**Chrome crashes?**
- Check `HEADLESS=true` in docker.env
- Ensure no other Chrome processes running

**Out of memory?**
- Increase memory limit in docker-compose.yml

## Full Documentation

See `DOCKER.md` for complete guide including:
- Production deployment
- Security best practices
- Backup/restore procedures
- Advanced configuration

## Support

For issues:
1. Check logs: `make logs`
2. Verify config: `cat config/docker.env`
3. Check status: `docker-compose ps`
4. See DOCKER.md
