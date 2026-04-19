$VPS_IP = "[VPS_IP]"
$REMOTE_USER = "admin"
$PEM_KEY = "scootware.pem"
$REMOTE_PATH = "/home/admin/Scootware-Forum"
$archive = "$env:TEMP\scoot-deploy.tar.gz"

Write-Host "--- Bundling Source Code ---" -ForegroundColor Cyan

If (Test-Path $archive) { Remove-Item $archive -Force }

Write-Host "  Creating tarball..." -ForegroundColor Yellow
tar --exclude="node_modules" `
    --exclude=".git" `
    --exclude=".pglite-data" `
    --exclude="dist" `
    --exclude=".venv" `
    --exclude=".next" `
    --exclude="build" `
    --exclude=".cache" `
    --exclude="*.log" `
    "--exclude=.md files" `
    -czf $archive .

if ($LASTEXITCODE -ne 0) { Write-Host "tar failed!" -ForegroundColor Red; exit 1 }
Write-Host "  Archive ready: $archive" -ForegroundColor Green

Write-Host "--- Uploading archive to VPS ---" -ForegroundColor Cyan
scp -i $PEM_KEY -o StrictHostKeyChecking=no $archive "${REMOTE_USER}@${VPS_IP}:${REMOTE_PATH}/project.tar.gz"
if ($LASTEXITCODE -ne 0) { Write-Host "SCP upload failed!" -ForegroundColor Red; exit 1 }
Write-Host "  [OK] Archive uploaded" -ForegroundColor Green

Write-Host "--- Uploading deploy script ---" -ForegroundColor Cyan
scp -i $PEM_KEY -o StrictHostKeyChecking=no "deploy-remote-cmd.sh" "${REMOTE_USER}@${VPS_IP}:${REMOTE_PATH}/deploy-remote-cmd.sh"
if ($LASTEXITCODE -ne 0) { Write-Host "SCP script upload failed!" -ForegroundColor Red; exit 1 }
Write-Host "  [OK] Script uploaded" -ForegroundColor Green

Write-Host "--- Running deploy on VPS ---" -ForegroundColor Cyan
ssh -i $PEM_KEY -o StrictHostKeyChecking=no "${REMOTE_USER}@${VPS_IP}" "bash /home/admin/Scootware-Forum/deploy-remote-cmd.sh"
if ($LASTEXITCODE -ne 0) { Write-Host "Remote deploy failed!" -ForegroundColor Red; exit 1 }

Write-Host "--- Deployment Complete! ---" -ForegroundColor Green
If (Test-Path $archive) { Remove-Item $archive -Force }
