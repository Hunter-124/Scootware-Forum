#!/bin/bash
echo "=== app.ts session middleware on VPS ==="
grep -n "x-session-id\|Bearer\|connect.sid\|query.sid\|query.token" /home/admin/Scootware-Forum/artifacts/api-server/src/app.ts 2>/dev/null | head -20

echo ""
echo "=== productAssets.ts diagnostic log on VPS ==="
grep -n "req.log.*info\|RequireProductSubscription" /home/admin/Scootware-Forum/artifacts/api-server/src/routes/productAssets.ts 2>/dev/null | head -10

echo ""
echo "=== Uploads dirs ==="
ls -la /home/admin/Scootware-Forum/ | grep upload
ls -la /home/admin/Scootware-Forum/artifacts/api-server/ | grep upload

echo ""
echo "=== Asset file_path in DB ==="
PGPASSWORD=[POSTGRES_PASSWORD] psql -h 127.0.0.1 -U postgres -d scootware -c "SELECT id, product_id, file_name, file_path FROM product_assets WHERE product_id='CS2';"

echo ""
echo "=== Does that file exist? ==="
PGPASSWORD=[POSTGRES_PASSWORD] psql -h 127.0.0.1 -U postgres -d scootware -t -c "SELECT file_path FROM product_assets WHERE product_id='CS2' LIMIT 1;" | xargs ls -la 2>&1
