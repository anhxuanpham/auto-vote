#!/bin/bash

# ================================================
# TopGG Auto Vote - GCP Deployment Script
# ================================================

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
ENV_FILE="$PROJECT_DIR/config/docker.env.local"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  TopGG Auto Vote - GCP Deployment${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if .env.local exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}Creating docker.env.local from template...${NC}"
    cp "$PROJECT_DIR/config/docker.env" "$ENV_FILE"
    echo -e "${RED}ERROR: $ENV_FILE not configured!${NC}"
    echo -e "${YELLOW}Please edit $ENV_FILE with your values:${NC}"
    echo "  - DISCORD_TOKEN_1/2/3"
    echo "  - TOPGG_BOT_ID"
    echo "  - CAPTCHALY_API_KEY"
    echo "  - DISCORD_WEBHOOK_URL"
    exit 1
fi

# Prompt for GCP details
echo -e "\n${YELLOW}Enter GCP VM Details:${NC}"
read -p "VM External IP: " VM_IP
read -p "VM Username (default: ubuntu): " VM_USER
VM_USER=${VM_USER:-ubuntu}

# Test SSH connection
echo -e "\n${YELLOW}Testing SSH connection...${NC}"
if ! ssh -o ConnectTimeout=5 "${VM_USER}@${VM_IP}" "echo 'Connection successful'" 2>/dev/null; then
    echo -e "${RED}ERROR: Cannot connect to ${VM_USER}@${VM_IP}${NC}"
    echo "Please ensure:"
    echo "  1. VM is running"
    echo "  2. SSH port 22 is open"
    echo "  3. You have SSH key or password access"
    exit 1
fi

# Deploy
echo -e "\n${GREEN}Deploying to GCP...${NC}"

# Stop existing service
echo -e "\n${YELLOW}Step 1: Stopping existing service...${NC}"
ssh "${VM_USER}@${VM_IP}" "cd ~/topgg-auto-vote && docker compose down 2>/dev/null || true"

# Pull latest code
echo -e "${YELLOW}Step 2: Pulling latest code...${NC}"
ssh "${VM_USER}@${VM_IP}" "cd ~/topgg-auto-vote && git pull origin master"

# Rebuild Docker image
echo -e "${YELLOW}Step 3: Rebuilding Docker image...${NC}"
ssh "${VM_USER}@${VM_IP}" "cd ~/topgg-auto-vote && docker compose build --no-cache"

# Start service
echo -e "${YELLOW}Step 4: Starting service...${NC}"
ssh "${VM_USER}@${VM_IP}" "cd ~/topgg-auto-vote && docker compose up -d"

# Wait for container to start
echo -e "${YELLOW}Step 5: Waiting for service to start...${NC}"
sleep 5

# Check status
echo -e "\n${GREEN}Deployment Status:${NC}"
ssh "${VM_USER}@${VM_IP}" "cd ~/topgg-auto-vote && docker compose ps"

# Show logs
echo -e "\n${GREEN}Recent Logs:${NC}"
ssh "${VM_USER}@${VM_IP}" "cd ~/topgg-auto-vote && docker compose logs --tail=20 topgg-vote"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\nTo view logs: ssh ${VM_USER}@${VM_IP} 'cd ~/topgg-auto-vote && docker compose logs -f'"
echo -e "To restart: ssh ${VM_USER}@${VM_IP} 'cd ~/topgg-auto-vote && docker compose restart'"
