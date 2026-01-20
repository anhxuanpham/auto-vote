# Docker Deployment Guide

This guide covers deploying the TopGG Auto Vote service using Docker containers.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 1GB RAM available
- 500MB disk space for image

## Quick Start

### 1. Configure Environment

Copy the example environment file and fill in your values:

```bash
cp config/docker.env.example config/docker.env
```

Edit `config/docker.env` with your configuration:

```env
DISCORD_TOKENS=your_token_here,another_token_here
TOPGG_BOT_ID=408785106942164992
VOTE_INTERVAL_HOURS=12
LOG_LEVEL=info
HEADLESS=true
```

### 2. Build and Start

Using Make (recommended):

```bash
make build
make run
```

Or using docker-compose directly:

```bash
docker-compose build
docker-compose up -d
```

### 3. View Logs

```bash
make logs
```

Or:

```bash
docker-compose logs -f topgg-vote
```

## Docker Commands

### Using Makefile

```bash
# Build image
make build

# Start container
make run

# View logs
make logs

# Stop container
make stop

# Rebuild and restart
make rebuild

# Clean everything (including volumes)
make clean

# Shell into container
make shell

# View container status
make ps
```

### Using Docker Compose

```bash
# Build image
docker-compose build

# Start container
docker-compose up -d

# View logs
docker-compose logs -f topgg-vote

# Stop container
docker-compose down

# Remove volumes
docker-compose down -v

# Rebuild without cache
docker-compose build --no-cache

# Execute command in container
docker-compose exec topgg-vote /bin/bash
```

## Volumes

The following directories are mounted as volumes for persistence:

- `./data` - Vote state and tracking data
- `./logs` - Application logs
- `./screenshots` - Debug screenshots (captured on errors)

## Resource Limits

Default resource limits (adjust in `docker-compose.yml`):

```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 1G
    reservations:
      cpus: '0.25'
      memory: 256M
```

## Health Check

The container includes a health check that runs every 5 minutes:

```yaml
healthcheck:
  test: ['CMD', 'node', '-e', 'console.log("healthy")']
  interval: 5m
  timeout: 30s
  retries: 3
  start_period: 10s
```

Check health status:

```bash
docker inspect --format='{{.State.Health.Status}}' topgg-auto-vote
```

## Troubleshooting

### Container Won't Start

1. Check logs:
   ```bash
   docker-compose logs topgg-vote
   ```

2. Verify environment variables:
   ```bash
   docker-compose config
   ```

3. Check if ports are already in use

### Chrome Crashes on Start

The Dockerfile includes all necessary Chrome dependencies and args for headless operation:

- `--no-sandbox` - Required for containers
- `--disable-setuid-sandbox` - Required for containers
- `--disable-dev-shm-usage` - Prevents shared memory issues

### Out of Memory

Increase memory limit in `docker-compose.yml`:

```yaml
deploy:
  resources:
    limits:
      memory: 2G  # Increase from 1G
```

### Permission Issues

The container runs as non-root user `appuser` (UID 1000). Ensure volume directories have correct permissions:

```bash
mkdir -p data logs screenshots
chmod -R 755 data logs screenshots
```

### Screenshots Are Blank

This should not happen with `HEADLESS=true` and `headless: "new"` mode. If you encounter blank screenshots:

1. Verify headless mode is enabled
2. Check for errors in logs
3. Try taking a screenshot manually:
   ```bash
   docker-compose exec topgg-vote node -e "const puppeteer=require('puppeteer');(async()=>{const b=await puppeteer.launch();const p=await b.newPage();await p.screenshot({path:'/app/screenshots/test.png'});await b.close();})()"
   ```

## Production Deployment

### On Linux Server

1. Transfer files to server:
   ```bash
   scp -r topgg-auto-vote/ user@server:/path/to/
   ```

2. SSH into server and configure:
   ```bash
   ssh user@server
   cd /path/to/topgg-auto-vote
   cp config/docker.env.example config/docker.env
   nano config/docker.env  # Edit configuration
   ```

3. Start container:
   ```bash
   make build
   make run
   ```

### Auto-Start on Boot

Enable Docker service to start on boot:

```bash
sudo systemctl enable docker
```

The container has `restart: unless-stopped`, so it will auto-start with Docker.

### Monitoring

#### View Resource Usage

```bash
docker stats topgg-auto-vote
```

#### View Recent Logs

```bash
docker-compose logs --tail=100 topgg-vote
```

#### Check Container Status

```bash
docker-compose ps
```

## Security Considerations

1. **Don't commit `docker.env`** - Contains sensitive tokens
2. **Use specific base image tags** - Not `latest` (we use `node:20-slim`)
3. **Run as non-root** - Container uses `appuser` (UID 1000)
4. **Scan images** - Use tools like Trivy or Snyk:
   ```bash
   docker scan topgg-auto-vote:latest
   ```
5. **Limit resources** - Prevent DoS via resource limits
6. **Use secrets management** - For production, consider Docker Swarm secrets or Kubernetes secrets

## Image Size Optimization

The multi-stage build keeps the final image small:

1. **Stage 1 (dependencies)**: Installs Chrome and builds
2. **Stage 2 (build)**: Compiles TypeScript
3. **Stage 3 (runtime)**: Minimal runtime image

Expected final size: ~400-500MB compressed

To check image size:

```bash
docker images topgg-auto-vote
```

## Updating

To update to a new version:

```bash
# Stop container
make stop

# Pull latest code
git pull origin main  # or extract new files

# Rebuild image
make rebuild
```

## Backup and Restore

### Backup Data

```bash
# Backup volumes
tar -czf backup-$(date +%Y%m%d).tar.gz data/ logs/ screenshots/

# Backup environment
cp config/docker.env backup/docker.env-$(date +%Y%m%d)
```

### Restore Data

```bash
# Extract backup
tar -xzf backup-20250119.tar.gz

# Restart container
make restart
```

## Advanced Configuration

### Custom Timezone

Set in `docker.env`:

```env
TIMEZONE=America/New_York
```

### Multiple Discord Tokens

Comma-separated in `docker.env`:

```env
DISCORD_TOKENS=token1,token2,token3
```

### Enable Debug Mode

```env
LOG_LEVEL=debug
HEADLESS=false  # Requires X server
```

## Support

For issues or questions:

1. Check logs: `make logs`
2. Verify configuration: `docker-compose config`
3. Check container status: `docker-compose ps`
4. Review health: `docker inspect topgg-auto-vote`
