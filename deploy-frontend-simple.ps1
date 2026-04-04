$ErrorActionPreference = "Stop"
$VPS_IP = "[VPS_IP]"
$REMOTE_USER = "admin"
$PEM_KEY = "scootware.pem"
$REMOTE_PATH = "/home/admin/Scootware-Forum"

Write-Host "=== Scootware Frontend Deployment ===" -ForegroundColor Cyan
Write-Host "Target: http://$VPS_IP/" -ForegroundColor Yellow

# Verify frontend build
Write-Host "`nVerifying frontend build..." -ForegroundColor Cyan
if (-Not (Test-Path "artifacts/forum/dist/public")) {
    Write-Host "ERROR: Frontend build not found!" -ForegroundColor Red
    exit 1
}
Write-Host "  OK - Build found" -ForegroundColor Green

# Create archive
Write-Host "Creating archive..." -ForegroundColor Cyan
$archivePath = "$env:TEMP\frontend.tar.gz"
if (Test-Path $archivePath) { Remove-Item $archivePath -Force }

Push-Location "artifacts/forum/dist/public"
tar -czf $archivePath *
Pop-Location

$sizeMB = [math]::Round((Get-Item $archivePath).Length / 1MB, 2)
Write-Host "  OK - Created $sizeMB MB archive" -ForegroundColor Green

# Upload
Write-Host "Uploading to VPS..." -ForegroundColor Cyan
scp -i $PEM_KEY -o StrictHostKeyChecking=no $archivePath "${REMOTE_USER}@${VPS_IP}:/tmp/frontend.tar.gz"
Write-Host "  OK - Upload complete" -ForegroundColor Green

# Extract on VPS
Write-Host "Extracting on VPS..." -ForegroundColor Cyan
ssh -i $PEM_KEY -o StrictHostKeyChecking=no "${REMOTE_USER}@${VPS_IP}" "mkdir -p /home/admin/Scootware-Forum/artifacts/forum/dist && rm -rf /home/admin/Scootware-Forum/artifacts/forum/dist/public.bak && mv /home/admin/Scootware-Forum/artifacts/forum/dist/public /home/admin/Scootware-Forum/artifacts/forum/dist/public.bak && mkdir -p /home/admin/Scootware-Forum/artifacts/forum/dist/public && cd /home/admin/Scootware-Forum/artifacts/forum/dist/public && tar -xzf /tmp/frontend.tar.gz && rm /tmp/frontend.tar.gz && echo OK"
Write-Host "  OK - Extraction complete" -ForegroundColor Green

Write-Host "`n[SUCCESS] Frontend deployed!" -ForegroundColor Green
Write-Host "Test at: http://$VPS_IP/" -ForegroundColor Yellow
