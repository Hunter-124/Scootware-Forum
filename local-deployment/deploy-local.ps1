# Scootware - Local/Remote Deployment Script (PowerShell)
# Usage:
#   .\local-deployment\deploy-local.ps1             -> remote sync + remote update
#   .\local-deployment\deploy-local.ps1 local       -> local build/migrate pipeline (good for offline testing)

param(
  [ValidateSet("local", "remote")]
  [string]$Mode = "remote"
)

if ($Mode -eq "local") {
  Write-Host "--- Running local deployment flow (auto equivalent to remote-manage update/build) ---" -ForegroundColor Cyan

  $ScriptDir = Split-Path -Parent $PSCommandPath
  $RepoRoot = Resolve-Path (Join-Path $ScriptDir "..")
  Set-Location $RepoRoot

  pnpm install
  if ($LASTEXITCODE -ne 0) { Write-Host "pnpm install failed" -ForegroundColor Red; exit 1 }

  if ($env:DATABASE_URL) {
    pnpm --filter @workspace/db run push-force
    if ($LASTEXITCODE -ne 0) { Write-Host "Database migration (push-force) failed" -ForegroundColor Red; exit 1 }
  } else {
    Write-Host "DATABASE_URL not set, skipping Drizzle push-force (local in-memory PGLite will be used)." -ForegroundColor Yellow
  }

  pnpm run build
  if ($LASTEXITCODE -ne 0) { Write-Host "Build failed" -ForegroundColor Red; exit 1 }

  Write-Host "--- Local pipeline complete. Run your local server with pnpm --filter ./artifacts/api-server dev (or start whichever target suits you). ---" -ForegroundColor Green
  exit 0
}

# Remote default path
$REMOTE_HOST = "scootware.us"
$REMOTE_USER = "ubuntu"
$REMOTE_PATH = "/home/admin/Scootware-Forum"
$RSYNC_EXE = "rsync" # Ensure rsync is in your Windows PATH (via Git Bash or WSL)

Write-Host "--- Syncing Scootware Forum to $REMOTE_HOST ---" -ForegroundColor Cyan

# Use rsync to only send necessary files
# Exclude node_modules, .git, and temporary build folders
& $RSYNC_EXE -avzP --delete `
    --exclude 'node_modules/' `
    --exclude '.git/' `
    --exclude '.pglite-data/' `
    --exclude 'artifacts/api-server/dist/' `
    --exclude 'local-deployment/' `
    --exclude 'live-deployment/' `
    --exclude 'deployment-manager/' `
    --exclude '*.md' `
    --exclude '*.markdown' `
    --exclude 'docs/' `
    --exclude 'artifacts/forum/dist/' `
    --exclude 'artifacts/mockup-sandbox/' `
    --exclude '*.log' `
    -e "ssh" `
    ./ "$($REMOTE_USER)@$($REMOTE_HOST):$($REMOTE_PATH)"

if ($LASTEXITCODE -eq 0) {
    Write-Host "--- Sync Complete. Triggering Remote Build... ---" -ForegroundColor Green
    ssh "$($REMOTE_USER)@$($REMOTE_HOST)" "bash $($REMOTE_PATH)/live-deployment/remote-manage.sh update"
}
else {
    Write-Host "--- Sync Failed. Check SSH connection. ---" -ForegroundColor Red
}
