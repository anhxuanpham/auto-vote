@echo off
REM TopGG Auto Vote - Docker Setup Script (Windows)
REM This script helps you set up Docker deployment quickly

echo ==================================
echo TopGG Auto Vote - Docker Setup
echo ==================================
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo Error: Docker is not installed
    echo Please install Docker Desktop first: https://docs.docker.com/desktop/install/windows-install/
    exit /b 1
)

REM Check if Docker Compose is installed
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo Error: Docker Compose is not installed
    echo Please install Docker Compose first
    exit /b 1
)

echo [OK] Docker and Docker Compose are installed
echo.

REM Check if docker.env exists
if not exist "config\docker.env" (
    echo Creating config\docker.env from template...
    copy config\docker.env.example config\docker.env
    echo [OK] Created config\docker.env
    echo.
    echo [!] IMPORTANT: Edit config\docker.env and add your Discord tokens!
    echo    notepad config\docker.env
    echo.
) else (
    echo [OK] config\docker.env already exists
)

REM Create data directories
echo Creating data directories...
if not exist "data" mkdir data
if not exist "logs" mkdir logs
if not exist "screenshots" mkdir screenshots
echo [OK] Created data directories
echo.

REM Ask if user wants to build now
set /p BUILD="Do you want to build the Docker image now? (y/n): "
if /i "%BUILD%"=="y" (
    echo Building Docker image...
    docker-compose build
    if errorlevel 1 (
        echo [ERROR] Build failed
        exit /b 1
    )
    echo [OK] Build complete
    echo.
)

REM Ask if user wants to start now
set /p START="Do you want to start the container now? (y/n): "
if /i "%START%"=="y" (
    echo Starting container...
    docker-compose up -d
    if errorlevel 1 (
        echo [ERROR] Failed to start container
        exit /b 1
    )
    echo [OK] Container started
    echo.
    echo View logs with: docker-compose logs -f
    echo Stop with: docker-compose down
) else (
    echo.
    echo To start later, run: docker-compose up -d
)

echo.
echo ==================================
echo Setup complete!
echo ==================================
echo.
echo Useful commands:
echo   make build      - Build Docker image
echo   make run        - Start container
echo   make logs       - View logs
echo   make stop       - Stop container
echo   make rebuild    - Rebuild and restart
echo.
echo For more info, see DOCKER.md
pause
