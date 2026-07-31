$ErrorActionPreference = "Stop"
$VPS_IP = $env:VPS_IP
$REMOTE_USER = $env:VPS_USER

Write-Host "Deploying patch files..."

scp -i "$env:SSH_KEY_PATH" -o StrictHostKeyChecking=no "artifacts\api-server\src\app.ts" "${REMOTE_USER}@${VPS_IP}:/home/admin/Scootware-Forum/artifacts/api-server/src/app.ts"
scp -i "$env:SSH_KEY_PATH" -o StrictHostKeyChecking=no "artifacts\api-server\src\routes\auth.ts" "${REMOTE_USER}@${VPS_IP}:/home/admin/Scootware-Forum/artifacts/api-server/src/routes/auth.ts"
scp -i "$env:SSH_KEY_PATH" -o StrictHostKeyChecking=no "artifacts\api-server\src\routes\admin.ts" "${REMOTE_USER}@${VPS_IP}:/home/admin/Scootware-Forum/artifacts/api-server/src/routes/admin.ts"
scp -i "$env:SSH_KEY_PATH" -o StrictHostKeyChecking=no "artifacts\api-server\src\lib\email.ts" "${REMOTE_USER}@${VPS_IP}:/home/admin/Scootware-Forum/artifacts/api-server/src/lib/email.ts"
scp -i "$env:SSH_KEY_PATH" -o StrictHostKeyChecking=no "artifacts\forum\src\pages\AuthPages.tsx" "${REMOTE_USER}@${VPS_IP}:/home/admin/Scootware-Forum/artifacts/forum/src/pages/AuthPages.tsx"
scp -i "$env:SSH_KEY_PATH" -o StrictHostKeyChecking=no "artifacts\forum\src\components\layout\AppLayout.tsx" "${REMOTE_USER}@${VPS_IP}:/home/admin/Scootware-Forum/artifacts/forum/src/components/layout/AppLayout.tsx"
scp -i "$env:SSH_KEY_PATH" -o StrictHostKeyChecking=no "lib\api-client-react\src\custom-fetch.ts" "${REMOTE_USER}@${VPS_IP}:/home/admin/Scootware-Forum/lib/api-client-react/src/custom-fetch.ts"
scp -i "$env:SSH_KEY_PATH" -o StrictHostKeyChecking=no "lib\db\src\index.ts" "${REMOTE_USER}@${VPS_IP}:/home/admin/Scootware-Forum/lib/db/src/index.ts"

Write-Host "Running build and clean restart..."
$cmd = "sudo fuser -k 3000/tcp || true; cd /home/admin/Scootware-Forum && pnpm run build && pm2 delete scootware-api || true; pm2 start ecosystem.config.cjs --update-env"
ssh -i "$env:SSH_KEY_PATH" -o StrictHostKeyChecking=no "${REMOTE_USER}@${VPS_IP}" $cmd

Write-Host "Done!"
