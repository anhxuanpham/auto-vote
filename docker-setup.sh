#!/bin/bash
# TopGG Auto Vote - Docker Setup Script
# This script helps you set up Docker deployment quickly

set -e

echo "=================================="
echo "TopGG Auto Vote - Docker Setup"
echo "=================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "Error: Docker Compose is not installed"
    echo "Please install Docker Compose first: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✓ Docker and Docker Compose are installed"
echo ""

# Check if docker.env exists
if [ ! -f "config/docker.env" ]; then
    echo "Creating config/docker.env from template..."
    cp config/docker.env.example config/docker.env
    echo "✓ Created config/docker.env"
    echo ""
    echo "⚠️  IMPORTANT: Edit config/docker.env and add your Discord tokens!"
    echo "   nano config/docker.env"
    echo ""
else
    echo "✓ config/docker.env already exists"
fi

# Create data directories
echo "Creating data directories..."
mkdir -p data logs screenshots
echo "✓ Created data directories"
echo ""

# Ask if user wants to build now
read -p "Do you want to build the Docker image now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Building Docker image..."
    docker-compose build
    echo "✓ Build complete"
    echo ""
fi

# Ask if user wants to start now
read -p "Do you want to start the container now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Starting container..."
    docker-compose up -d
    echo "✓ Container started"
    echo ""
    echo "View logs with: docker-compose logs -f"
    echo "Stop with: docker-compose down"
else
    echo ""
    echo "To start later, run: docker-compose up -d"
fi

echo ""
echo "=================================="
echo "Setup complete!"
echo "=================================="
echo ""
echo "Useful commands:"
echo "  make build      - Build Docker image"
echo "  make run        - Start container"
echo "  make logs       - View logs"
echo "  make stop       - Stop container"
echo "  make rebuild    - Rebuild and restart"
echo ""
echo "For more info, see DOCKER.md"
