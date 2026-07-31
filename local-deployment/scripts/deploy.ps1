# Scootware Forum - Automated Deployment Script (PowerShell)
# Usage: ./deploy.ps1

$VPS_IP = "[VPS_IP]"
$REMOTE_USER = "admin"
$REMOTE_PATH = "/home/admin/Scootware-Forum"
$TEMP_ARCHIVE = "deploy.tar.gz"

Write-Host "--- Starting Scootware Forum Deployment ---" -ForegroundColor Cyan

# 1. Clean up local state (optional but recommended)
Write-Host "[1/5] Cleaning local artifacts..."
if (Test-Path "deploy.tar.gz") { Remove-Item "deploy.tar.gz" }

# 2. Package current version (excluding node_modules, .git, and local builds)
Write-Host "[2/5] Creating deployment archive..."
tar --exclude='node_modules' --exclude='.git' --exclude='.pnpm-store' --exclude='dist' --exclude='.pglite-data' -czf $TEMP_ARCHIVE .

# 3. Upload to VPS
Write-Host "[3/5] Uploading to $VPS_IP..."
scp -i "[YOUR_SSH_KEY_PATH]" -o StrictHostKeyChecking=no $TEMP_ARCHIVE "${REMOTE_USER}@${VPS_IP}:/tmp/"

# 4. Remote Execution
Write-Host "[4/5] Executing remote update commands..."
$remote_commands = @"
cd $REMOTE_PATH
# Move the archive from /tmp to the project folder
mv /tmp/$TEMP_ARCHIVE .
# Extract and overwrite
tar -xzf $TEMP_ARCHIVE --overwrite
rm $TEMP_ARCHIVE

# Install & Build

pnpm install
pnpm --filter @workspace/db run push --force
pnpm run build

# Reload service (Zero-downtime if using PM2)
pm2 reload scootware-api --node-args="--env-file=.env" || pm2 start artifacts/api-server/dist/index.mjs --name 'scootware-api' --node-args="--env-file=.env"

# Reload Nginx
sudo systemctl reload nginx
"@

ssh -i "[YOUR_SSH_KEY_PATH]" -o StrictHostKeyChecking=no "${REMOTE_USER}@${VPS_IP}" $remote_commands

# 5. Cleanup
Write-Host "[5/5] Final cleanup..."
Remove-Item $TEMP_ARCHIVE

Write-Host "`nDEPLOIMENT COMPLETE: Scootware Forum is live at http://$VPS_IP" -ForegroundColor Green
