.PHONY: build run dev stop clean logs rebuild shell test help

# Default target
help:
	@echo "TopGG Auto Vote - Docker Management"
	@echo ""
	@echo "Available targets:"
	@echo "  build     - Build Docker image"
	@echo "  run       - Start container in detached mode"
	@echo "  dev       - Start container in foreground (logs)"
	@echo "  stop      - Stop and remove container"
	@echo "  clean     - Stop container and remove volumes"
	@echo "  logs      - View container logs"
	@echo "  rebuild   - Rebuild and restart container"
	@echo "  shell     - Open shell in running container"
	@echo "  test      - Run tests in container"
	@echo "  ps        - Show container status"
	@echo "  help      - Show this help message"

# Build Docker image
build:
	@echo "Building Docker image..."
	docker-compose build

# Run container in detached mode
run:
	@echo "Starting container..."
	docker-compose up -d

# Run container in foreground (development mode)
dev:
	@echo "Starting container in foreground..."
	docker-compose up

# Stop container
stop:
	@echo "Stopping container..."
	docker-compose down

# Clean volumes
clean:
	@echo "Stopping container and removing volumes..."
	docker-compose down -v
	@echo "Cleaning local data directories..."
	rm -rf data logs screenshots

# View logs
logs:
	docker-compose logs -f

# Rebuild and restart
rebuild: stop build run

# Shell into container
shell:
	docker-compose exec topgg-vote /bin/bash

# Run tests
test:
	docker-compose run --rm topgg-vote npm test

# Show container status
ps:
	docker-compose ps

# Build without cache
build-no-cache:
	@echo "Building Docker image without cache..."
	docker-compose build --no-cache

# View container resources
stats:
	docker stats topgg-auto-vote

# Restart container
restart:
	@echo "Restarting container..."
	docker-compose restart

# Pull latest base images
pull:
	docker pull node:20-slim

# Show container logs (last 100 lines)
logs-tail:
	docker-compose logs --tail=100 topgg-vote
