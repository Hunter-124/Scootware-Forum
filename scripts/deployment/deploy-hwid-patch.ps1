$ErrorActionPreference = "Stop"
$VPS_IP = $env:VPS_IP
$REMOTE_USER = $env:VPS_USER
$PEM = $env:SSH_KEY_PATH
$REMOTE_PATH = $env:VPS_REMOTE_PATH

function Upload($local, $remote) {
    Write-Host "  Uploading $local ..." -ForegroundColor Yellow
    & scp -i $PEM -o StrictHostKeyChecking=no $local "${REMOTE_USER}@${VPS_IP}:${REMOTE_PATH}/$remote"
    if ($LASTEXITCODE -ne 0) { throw "SCP failed for $local" }
}

function Invoke-Remote($cmd) {
    & ssh -i $PEM -o StrictHostKeyChecking=no "${REMOTE_USER}@${VPS_IP}" $cmd
}

Write-Host "--- Creating remote directories ---" -ForegroundColor Cyan
Invoke-Remote "mkdir -p ${REMOTE_PATH}/artifacts/api-server/src/routes ${REMOTE_PATH}/lib/db/src/schema ${REMOTE_PATH}/artifacts/forum/src/pages"

Write-Host "--- Uploading changed files ---" -ForegroundColor Cyan

# DB schema
Upload "lib\db\src\schema\hwid_reset_requests.ts" "lib/db/src/schema/hwid_reset_requests.ts"
Upload "lib\db\src\schema\index.ts"               "lib/db/src/schema/index.ts"
Upload "lib\db\src\schema\users.ts"               "lib/db/src/schema/users.ts"

# API server routes
Upload "artifacts\api-server\src\routes\hwidReset.ts"     "artifacts/api-server/src/routes/hwidReset.ts"
Upload "artifacts\api-server\src\routes\index.ts"          "artifacts/api-server/src/routes/index.ts"
Upload "artifacts\api-server\src\routes\productAssets.ts"  "artifacts/api-server/src/routes/productAssets.ts"

# Forum frontend (Admin panel)
Upload "artifacts\forum\src\pages\Admin.tsx" "artifacts/forum/src/pages/Admin.tsx"

Write-Host "--- Running DB migration + rebuild on VPS ---" -ForegroundColor Cyan

# Write remote script to a temp file, upload, run, then delete
$tmpScript = "$env:TEMP\hwid_deploy_remote.sh"
@'
#!/bin/bash
set -e
cd /home/admin/Scootware-Forum
echo '[1/3] Running DB migration...'
export DATABASE_URL=$(grep '^DATABASE_URL=' .env | head -1 | cut -d= -f2-)
pnpm --filter @workspace/db run push-force || echo 'Migration done (or already up-to-date)'
echo '[2/3] Building...'
pnpm run build
echo '[3/3] Restarting PM2...'
pm2 restart scootware-api --update-env || pm2 start ecosystem.config.cjs --update-env
echo 'Done!'
'@ | Set-Content -Encoding utf8 -Path $tmpScript

scp -i $PEM -o StrictHostKeyChecking=no $tmpScript "${REMOTE_USER}@${VPS_IP}:/tmp/hwid_deploy.sh"
ssh -i $PEM -o StrictHostKeyChecking=no "${REMOTE_USER}@${VPS_IP}" "bash /tmp/hwid_deploy.sh; rm /tmp/hwid_deploy.sh"
Remove-Item $tmpScript -Force

Write-Host "--- Patch deployed successfully! ---" -ForegroundColor Green
