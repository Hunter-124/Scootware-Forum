#!/bin/bash
# Quick diagnostic to check if API and Nginx are working

echo "=== QUICK DIAGNOSTICS ==="
echo ""

echo "[1] PM2 Status:"
pm2 status
echo ""

echo "[2] Last 30 lines of API log:"
pm2 logs scootware-api --lines 30 --nostream
echo ""

echo "[3] Nginx Status:"
sudo systemctl status nginx
echo ""

echo "[4] Check if ports are listening:"
echo "Port 3000 (API):"
netstat -tlnp 2>/dev/null | grep 3000 || lsof -i :3000 2>/dev/null || echo "  Not listening on port 3000"
echo ""
echo "Port 80 (Nginx):"
netstat -tlnp 2>/dev/null | grep :80 || lsof -i :80 2>/dev/null || echo "  Not listening on port 80"
echo ""

echo "[5] Test API direct:"
echo "Trying to connect to API on port 3000..."
curl -v http://localhost:3000/api/healthz 2>&1 | head -20
echo ""

echo "[6] Test via Nginx:"
echo "Trying to connect via Nginx on port 80..."
curl -v http://localhost/api/healthz 2>&1 | head -20
echo ""

echo "=== END DIAGNOSTICS ==="
echo ""
echo "If API is not running:"
echo "  1. Check for errors: pm2 logs scootware-api"
echo "  2. Restart it: pm2 restart scootware-api"
echo "  3. Or manually run: cd /home/admin/Scootware-Forum && node boot.mjs"
