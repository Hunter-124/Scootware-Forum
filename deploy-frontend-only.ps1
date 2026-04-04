# Scootware Frontend-Only Deployment Script
# Deploys only the frontend built files to the VPS

$ErrorActionPreference = "Stop"
$VPS_IP = "[VPS_IP]"
$REMOTE_USER = "admin"
$PEM_KEY = "scootware.pem"
$REMOTE_PATH = "/home/admin/Scootware-Forum"

$frontendSourceDir = "artifacts/forum/dist/public"
$archiveName = "scootware-frontend.tar.gz"
$archivePath = "$env:TEMP\$archiveName"

Write-Host "=== Scootware Frontend Deployment ===" -ForegroundColor Cyan
Write-Host "Target: https://scootware.us" -ForegroundColor Yellow
Write-Host "VPS IP: $VPS_IP" -ForegroundColor Yellow

# Verify frontend files exist
Write-Host "`n[1/5] Verifying frontend build..." -ForegroundColor Cyan
if (-Not (Test-Path $frontendSourceDir)) {
    Write-Host "ERROR: Frontend build not found at $frontendSourceDir" -ForegroundColor Red
    Write-Host "Run 'pnpm run build:prod' first!" -ForegroundColor Yellow
    exit 1
}

$fileCount = @(Get-ChildItem -Path $frontendSourceDir -Recurse -File).Count
Write-Host "  ✓ Found $fileCount files in dist/public" -ForegroundColor Green

# Create archive
Write-Host "`n[2/5] Creating deployment archive..." -ForegroundColor Cyan
if (Test-Path $archivePath) { Remove-Item $archivePath -Force }

Push-Location $frontendSourceDir
tar -czf $archivePath *
Pop-Location

$archiveSize = (Get-Item $archivePath).Length / 1MB
Write-Host ("  ✓ Archive created: {0:F2} MB" -f $archiveSize) -ForegroundColor Green

# Upload to VPS
Write-Host "`n[3/5] Uploading to VPS..." -ForegroundColor Cyan
try {
    scp -i $PEM_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10 `
        $archivePath "${REMOTE_USER}@${VPS_IP}:${REMOTE_PATH}/"
    Write-Host "  ✓ Upload complete" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Upload failed: $_" -ForegroundColor Red
    exit 1
}

# Extract on VPS
Write-Host "`n[4/5] Extracting files on VPS..." -ForegroundColor Cyan
$remote_extract_cmd = @"
cd ${REMOTE_PATH}
if [ -f ${archiveName} ]; then
    rm -rf artifacts/forum/dist/public.backup
    mv artifacts/forum/dist/public artifacts/forum/dist/public.backup 2>/dev/null || true
    mkdir -p artifacts/forum/dist/public
    cd artifacts/forum/dist/public
    tar -xzf ${REMOTE_PATH}/${archiveName}
    rm -f ${REMOTE_PATH}/${archiveName}
    echo "✓ Frontend extracted successfully"
else
    echo "✗ Archive not found on VPS"
    exit 1
fi
"@

try {
    ssh -i $PEM_KEY -o StrictHostKeyChecking=no "${REMOTE_USER}@${VPS_IP}" $remote_extract_cmd
    Write-Host "  ✓ Files extracted" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Extraction failed: $_" -ForegroundColor Red
    exit 1
}

# Verify deployment
Write-Host "`n[5/5] Verifying deployment..." -ForegroundColor Cyan
$verify_cmd = @"
if [ -f /home/admin/Scootware-Forum/artifacts/forum/dist/public/index.html ]; then
    echo "✓ index.html present"
    ls -lh /home/admin/Scootware-Forum/artifacts/forum/dist/public/ | head -5
else
    echo "✗ index.html not found!"
    exit 1
fi
"@

ssh -i $PEM_KEY -o StrictHostKeyChecking=no "${REMOTE_USER}@${VPS_IP}" $verify_cmd

Write-Host "`n[SUCCESS] Frontend deployed!" -ForegroundColor Green
Write-Host "Monitor at: https://scootware.us" -ForegroundColor Yellow
Write-Host "Backend API: https://scootware.us/api/health" -ForegroundColor Yellow
