# Scootware Full Deployment Script
$ErrorActionPreference = "Stop"
$VPS_IP = "[VPS_IP]"
$REMOTE_USER = "admin"
$PEM_KEY = "scootware.pem"
$REMOTE_PATH = "/home/admin/Scootware-Forum"

Write-Host "--- Bundling Source Code ---" -ForegroundColor Cyan
$archive = "$env:TEMP\scoot-deploy.tar.gz"
If (Test-Path $archive) { Remove-Item $archive -Force }

Write-Host "  Verifying critical files exist..." -ForegroundColor Yellow
$criticalFiles = @(
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "package.json",
    "tsconfig.json",
    "lib/db/package.json",
    "lib/db/drizzle.config.ts",
    "artifacts/api-server/package.json",
    "artifacts/api-server/tsconfig.json",
    "artifacts/forum/package.json",
    "artifacts/forum/tsconfig.json"
)

foreach ($file in $criticalFiles) {
    if (-Not (Test-Path $file)) {
        Write-Host "  ⚠ WARNING: Missing critical file: $file" -ForegroundColor Red
    } else {
        Write-Host "  ✓ Found: $file" -ForegroundColor Green
    }
}

Write-Host "  Creating tarball with necessary files..." -ForegroundColor Yellow
# Create a tarball excluding node_modules, .git, and build artifacts
# Explicitly preserve pnpm configuration and lock files
tar --exclude="node_modules" `
    --exclude=".git" `
    --exclude=".pglite-data" `
    --exclude="dist" `
    --exclude=".venv" `
    --exclude=".next" `
    --exclude="build" `
    --exclude=".cache" `
    --exclude="*.log" `
    -czf $archive .

Write-Host "  Archive created: $archive" -ForegroundColor Green
Write-Host "  Verifying archive contents..." -ForegroundColor Yellow
tar -tzf $archive | grep -E "(pnpm-lock|package\.json|tsconfig|drizzle\.config)" | Select-Object -First 20

Write-Host "--- Uploading to VPS ---" -ForegroundColor Cyan
scp -i $PEM_KEY -o StrictHostKeyChecking=no $archive "${REMOTE_USER}@${VPS_IP}:${REMOTE_PATH}/project.tar.gz"

Write-Host "--- Verifying Uploaded Archive ---" -ForegroundColor Cyan
# Verify the archive was uploaded successfully and contains necessary files
$remote_verify_cmd = @"
cd ${REMOTE_PATH}
if [ ! -f project.tar.gz ]; then
    echo "❌ Archive not received!"
    exit 1
fi
echo "✓ Archive received ($(ls -lh project.tar.gz | awk '{print \$5}'))"
echo "  Checking archive contents for critical files..."
tar -tzf project.tar.gz | grep -E '(pnpm-lock|package\.json|tsconfig|drizzle\.config)' | head -20
if [ \$? -eq 0 ]; then
    echo "✓ Critical files found in archive"
else
    echo "⚠ WARNING: Could not verify critical files in archive"
fi
"@

ssh -i $PEM_KEY -o StrictHostKeyChecking=no "${REMOTE_USER}@${VPS_IP}" bash -c "$remote_verify_cmd"

Write-Host "--- Extracting and Deploying ---" -ForegroundColor Cyan
$remote_cmd = @"
cd ${REMOTE_PATH}
tar -xzf project.tar.gz
rm project.tar.gz
# Run the remote manager to build and restart
bash live-deployment/remote-manage.sh all
"@

ssh -i $PEM_KEY -o StrictHostKeyChecking=no "${REMOTE_USER}@${VPS_IP}" $remote_cmd

Write-Host "--- Deployment Complete! ---" -ForegroundColor Green
# Clean up local archive
If (Test-Path $archive) { Remove-Item $archive -Force }
