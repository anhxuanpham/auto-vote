# GCP Deployment Guide - TopGG Auto Vote Service

## Prerequisites

1. **GCP VM Instance** running Ubuntu/Debian
2. **Docker & Docker Compose** installed on VM
3. **GitHub Repository** with project code

---

## Step 1: Connect to GCP VM

```bash
# SSH into your GCP VM
gcloud compute ssh <INSTANCE_NAME> --zone=<ZONE> --project=<PROJECT_ID>

# Or using external IP
ssh ubuntu@<EXTERNAL_IP>
```

---

## Step 2: Install Docker & Docker Compose

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group (no sudo needed)
sudo usermod -aG docker $USER
newgrp docker

# Verify Docker
docker --version
docker compose version
```

---

## Step 3: Clone Repository

```bash
# Clone your repository
git clone https://github.com/<YOUR_USERNAME>/<REPO_NAME>.git
cd <REPO_NAME>/topgg-auto-vote
```

---

## Step 4: Configure Environment

```bash
# Copy docker.env template
cp config/docker.env config/docker.env.local

# Edit with your values
nano config/docker.env.local
```

**Required variables:**
```bash
DISCORD_TOKEN_1=your_token_here
DISCORD_TOKEN_2=your_token_here
DISCORD_TOKEN_3=your_token_here
TOPGG_BOT_ID=408785106942164992
CAPTCHALY_API_KEY=your_api_key
DISCORD_WEBHOOK_URL=your_webhook_url
VOTE_INTERVAL_HOURS=12
CRON_EXPRESSION=0 */12 * * *
TIMEZONE=Asia/Ho_Chi_Minh
```

---

## Step 5: Build & Run

```bash
# Build Docker image
docker compose build

# Start service
docker compose up -d

# View logs
docker compose logs -f

# Check status
docker compose ps
```

---

## Step 6: Verify Deployment

```bash
# Check container is running
docker compose ps

# View real-time logs
docker compose logs -f topgg-vote

# Check last 100 lines
docker compose logs --tail=100 topgg-vote
```

**Expected output:**
```
[INFO] Initializing scheduler...
[INFO] Votes scheduled successfully
[INFO] Next vote in Xh Ym
```

---

## Management Commands

### View Logs
```bash
# Follow logs
docker compose logs -f

# Last 50 lines
docker compose logs --tail=50

# Specific service
docker compose logs -f topgg-vote
```

### Restart Service
```bash
docker compose restart
```

### Stop Service
```bash
docker compose down
```

### Update Service
```bash
# Pull latest code
git pull origin main

# Rebuild & restart
docker compose down
docker compose build
docker compose up -d
```

### Check Data Persistence
```bash
# View state file
cat data/state.json

# View logs
ls -lh logs/
tail -f logs/*.log
```

---

## Monitoring

### Health Check
```bash
# Check container health
docker compose ps
docker inspect topgg-auto-vote | grep -A 10 Health
```

### Disk Usage
```bash
# Check volume sizes
docker system df

# Clean up old images
docker system prune -a
```

### Resource Usage
```bash
# Container stats
docker stats topgg-auto-vote

# System resources
htop
```

---

## Troubleshooting

### Container Won't Start
```bash
# Check logs
docker compose logs

# Check configuration
cat config/docker.env.local

# Rebuild without cache
docker compose build --no-cache
```

### Vote Failures
```bash
# Check error logs
docker compose logs | grep ERROR

# View state
cat data/state.json

# Test manually
docker compose exec topgg-vote node dist/index.js
```

### Chrome Issues
```bash
# Check Chrome installation
docker compose exec topgg-vote google-chrome --version

# Update image
docker compose build --pull
```

---

## Security Best Practices

1. **Never commit `docker.env.local` to git**
2. **Use GitHub Secrets** for sensitive data
3. **Regular updates**:
   ```bash
   # Update system
   sudo apt-get update && sudo apt-get upgrade -y

   # Update Docker
   docker compose build --pull
   ```
4. **Firewall rules**:
   - Only allow SSH (22) from your IP
   - Block all other inbound ports

---

## Backup & Restore

### Backup Data
```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backup/topgg-$(date +%Y%m%d-%H%M%S)"
mkdir -p $BACKUP_DIR
cp -r data $BACKUP_DIR/
cp -r logs $BACKUP_DIR/
tar -czf $BACKUP_DIR.tar.gz $BACKUP_DIR
rm -rf $BACKUP_DIR
echo "Backup: $BACKUP_DIR.tar.gz"
EOF

chmod +x backup.sh
./backup.sh
```

### Restore Data
```bash
# Extract backup
tar -xzf topgg-YYYYMMDD-HHMMSS.tar.gz

# Stop service
docker compose down

# Restore data
cp -r backup/data/* data/
cp -r backup/logs/* logs/

# Start service
docker compose up -d
```

---

## Cost Optimization

1. **Use e2-micro** or **e2-small** instance (sufficient for this workload)
2. **Schedule VM start/stop** if not needed 24/7
3. **Use preemptible VM** for development/testing

---

## Support

- Check logs: `docker compose logs -f`
- View state: `cat data/state.json`
- GitHub Issues: https://github.com/<YOUR_USERNAME>/<REPO>/issues
