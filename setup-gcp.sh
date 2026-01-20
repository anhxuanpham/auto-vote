#!/bin/bash

# ================================================
# TopGG Auto Vote - GCP Initial Setup Script
# Run this on NEW GCP VM instances
# ================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  TopGG Auto Vote - Initial Setup${NC}"
echo -e "${GREEN}========================================${NC}"

# Update system
echo -e "\n${YELLOW}Step 1: Updating system...${NC}"
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
echo -e "\n${YELLOW}Step 2: Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo -e "${GREEN}Docker installed successfully${NC}"
else
    echo -e "${GREEN}Docker already installed${NC}"
fi

# Verify Docker
echo -e "\n${YELLOW}Step 3: Verifying Docker...${NC}"
docker --version
docker compose version

# Install Git if not present
echo -e "\n${YELLOW}Step 4: Installing Git...${NC}"
if ! command -v git &> /dev/null; then
    sudo apt-get install -y git
    echo -e "${GREEN}Git installed${NC}"
else
    echo -e "${GREEN}Git already installed${NC}"
fi

# Prompt for repository URL
echo -e "\n${YELLOW}Step 5: Clone Repository${NC}"
read -p "Enter GitHub repository URL (e.g., https://github.com/user/repo.git): " REPO_URL

if [ -z "$REPO_URL" ]; then
    echo -e "${RED}ERROR: Repository URL required${NC}"
    exit 1
fi

# Clone repository
if [ -d "~/topgg-auto-vote" ]; then
    echo -e "${YELLOW}Repository already exists, pulling latest...${NC}"
    cd ~/topgg-auto-vote
    git pull origin master
else
    echo -e "${GREEN}Cloning repository...${NC}"
    git clone "$REPO_URL" ~/topgg-auto-vote
    cd ~/topgg-auto-vote
fi

# Setup environment file
echo -e "\n${YELLOW}Step 6: Configure Environment${NC}"
if [ ! -f "config/docker.env.local" ]; then
    cp config/docker.env config/docker.env.local
    echo -e "${GREEN}Created config/docker.env.local${NC}"
    echo -e "${RED}Please edit this file with your values:${NC}"
    echo "  nano ~/topgg-auto-vote/config/docker.env.local"
    echo ""
    echo "Required variables:"
    echo "  - DISCORD_TOKEN_1/2/3"
    echo "  - TOPGG_BOT_ID"
    echo "  - CAPTCHALY_API_KEY"
    echo "  - DISCORD_WEBHOOK_URL"
    echo "  - TIMEZONE"
else
    echo -e "${GREEN}Environment file already exists${NC}"
fi

# Create necessary directories
echo -e "\n${YELLOW}Step 7: Creating data directories...${NC}"
mkdir -p data logs screenshots
echo -e "${GREEN}Directories created${NC}"

# Build Docker image
echo -e "\n${YELLOW}Step 8: Building Docker image...${NC}"
docker compose build

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\nNext steps:"
echo -e "1. Edit environment: ${YELLOW}nano ~/topgg-auto-vote/config/docker.env.local${NC}"
echo -e "2. Start service: ${YELLOW}cd ~/topgg-auto-vote && docker compose up -d${NC}"
echo -e "3. View logs: ${YELLOW}docker compose logs -f${NC}"
echo -e "4. Check status: ${YELLOW}docker compose ps${NC}"
echo ""
echo -e "${RED}IMPORTANT: Log out and back in for Docker group changes to take effect!${NC}"
