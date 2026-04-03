$ErrorActionPreference = "Stop"
$VPS_IP = "[VPS_IP]"
$REMOTE_USER = "admin"

Write-Host "Deploying patch files..."

scp -i "scootware.pem" -o StrictHostKeyChecking=no "artifacts\api-server\src\routes\auth.ts" "${REMOTE_USER}@${VPS_IP}:/home/admin/Scootware-Forum/artifacts/api-server/src/routes/auth.ts"
scp -i "scootware.pem" -o StrictHostKeyChecking=no "artifacts\api-server\src\routes\admin.ts" "${REMOTE_USER}@${VPS_IP}:/home/admin/Scootware-Forum/artifacts/api-server/src/routes/admin.ts"
scp -i "scootware.pem" -o StrictHostKeyChecking=no "artifacts\api-server\src\lib\email.ts" "${REMOTE_USER}@${VPS_IP}:/home/admin/Scootware-Forum/artifacts/api-server/src/lib/email.ts"
scp -i "scootware.pem" -o StrictHostKeyChecking=no "artifacts\forum\src\pages\AuthPages.tsx" "${REMOTE_USER}@${VPS_IP}:/home/admin/Scootware-Forum/artifacts/forum/src/pages/AuthPages.tsx"
scp -i "scootware.pem" -o StrictHostKeyChecking=no "artifacts\forum\src\components\layout\AppLayout.tsx" "${REMOTE_USER}@${VPS_IP}:/home/admin/Scootware-Forum/artifacts/forum/src/components/layout/AppLayout.tsx"
scp -i "scootware.pem" -o StrictHostKeyChecking=no "lib\api-client-react\src\custom-fetch.ts" "${REMOTE_USER}@${VPS_IP}:/home/admin/Scootware-Forum/lib/api-client-react/src/custom-fetch.ts"
scp -i "scootware.pem" -o StrictHostKeyChecking=no "lib\db\src\index.ts" "${REMOTE_USER}@${VPS_IP}:/home/admin/Scootware-Forum/lib/db/src/index.ts"

Write-Host "Running build and reload..."
$cmd = "cd /home/admin/Scootware-Forum && pnpm run build && pm2 reload scootware-api"
ssh -i "scootware.pem" -o StrictHostKeyChecking=no "${REMOTE_USER}@${VPS_IP}" $cmd

Write-Host "Done!"
