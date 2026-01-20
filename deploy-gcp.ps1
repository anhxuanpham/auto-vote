# ================================================
# TopGG Auto Vote - GCP Deployment Script (PowerShell)
# ================================================

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = $ScriptDir
$EnvFile = "$ProjectDir\config\docker.env.local"

Write-Host "========================================" -ForegroundColor Green
Write-Host "  TopGG Auto Vote - GCP Deployment" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check if .env.local exists
if (-Not (Test-Path $EnvFile)) {
    Write-Host "Creating docker.env.local from template..." -ForegroundColor Yellow
    Copy-Item "$ProjectDir\config\docker.env" $EnvFile

    Write-Host "ERROR: $EnvFile not configured!" -ForegroundColor Red
    Write-Host "Please edit $EnvFile with your values:" -ForegroundColor Yellow
    Write-Host "  - DISCORD_TOKEN_1/2/3"
    Write-Host "  - TOPGG_BOT_ID"
    Write-Host "  - CAPTCHALY_API_KEY"
    Write-Host "  - DISCORD_WEBHOOK_URL"
    exit 1
}

# Prompt for GCP details
Write-Host "Enter GCP VM Details:" -ForegroundColor Yellow
$VM_IP = Read-Host "VM External IP"
$VM_USER = Read-Host "VM Username (default: ubuntu)"
if ([string]::IsNullOrWhiteSpace($VM_USER)) {
    $VM_USER = "ubuntu"
}

# Test SSH connection
Write-Host "`nTesting SSH connection..." -ForegroundColor Yellow
$sshTest = ssh -o ConnectTimeout=5 "$VM_USER@$VM_IP" "echo 'Connection successful'" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Cannot connect to $VM_USER@$VM_IP" -ForegroundColor Red
    Write-Host "Please ensure:"
    Write-Host "  1. VM is running"
    Write-Host "  2. SSH port 22 is open"
    Write-Host "  3. You have SSH key or password access"
    exit 1
}

# Deploy
Write-Host "`nDeploying to GCP..." -ForegroundColor Green

# Stop existing service
Write-Host "`nStep 1: Stopping existing service..." -ForegroundColor Yellow
ssh "$VM_USER@$VM_IP" "cd ~/topgg-auto-vote && docker compose down 2>/dev/null || true"

# Pull latest code
Write-Host "Step 2: Pulling latest code..." -ForegroundColor Yellow
ssh "$VM_USER@$VM_IP" "cd ~/topgg-auto-vote && git pull origin master"

# Rebuild Docker image
Write-Host "Step 3: Rebuilding Docker image..." -ForegroundColor Yellow
ssh "$VM_USER@$VM_IP" "cd ~/topgg-auto-vote && docker compose build --no-cache"

# Start service
Write-Host "Step 4: Starting service..." -ForegroundColor Yellow
ssh "$VM_USER@$VM_IP" "cd ~/topgg-auto-vote && docker compose up -d"

# Wait for container to start
Write-Host "Step 5: Waiting for service to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Check status
Write-Host "`nDeployment Status:" -ForegroundColor Green
ssh "$VM_USER@$VM_IP" "cd ~/topgg-auto-vote && docker compose ps"

# Show logs
Write-Host "`nRecent Logs:" -ForegroundColor Green
ssh "$VM_USER@$VM_IP" "cd ~/topgg-auto-vote && docker compose logs --tail=20 topgg-vote"

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "`nTo view logs: ssh $VM_USER@$VM_IP 'cd ~/topgg-auto-vote && docker compose logs -f'"
Write-Host "To restart: ssh $VM_USER@$VM_IP 'cd ~/topgg-auto-vote && docker compose restart'"
