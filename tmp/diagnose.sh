#!/bin/bash
echo "=== PM2 STATUS ==="
pm2 list

echo ""
echo "=== PRODUCT ASSETS IN DB ==="
psql $DATABASE_URL -c "SELECT id, product_id, asset_type, file_name, file_path, is_active FROM product_assets ORDER BY id DESC LIMIT 20;" 2>&1

echo ""
echo "=== PRODUCT ACCESS (subscriptions) ==="
psql $DATABASE_URL -c "SELECT pa.user_id, u.username, pa.product_id, pa.expires_at FROM product_access pa JOIN users u ON u.id = pa.user_id ORDER BY pa.expires_at DESC LIMIT 20;" 2>&1

echo ""
echo "=== UPLOADS DIR ==="
ls -la /home/admin/Scootware-Forum/artifacts/api-server/uploads/product_assets/ 2>&1

echo ""
echo "=== RECENT API LOGS (last 50 lines) ==="
pm2 logs scootware-api --lines 50 --nostream 2>&1
