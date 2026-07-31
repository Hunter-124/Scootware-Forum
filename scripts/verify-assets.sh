#!/bin/bash
# Asset Verification Script - Run this on the server after deployment

echo "=== SCOOTWARE ASSET VERIFICATION ==="
echo ""

APP_PATH="/home/admin/Scootware-Forum"

# Check 1: Verify forum dist files exist
echo "[1] Checking forum dist structure..."
DIST_PATH="$APP_PATH/artifacts/forum/dist/public"
if [ -d "$DIST_PATH" ]; then
    echo "    ✓ $DIST_PATH exists"
    
    # Check for asset files
    if [ -d "$DIST_PATH/assets" ]; then
        ASSET_COUNT=$(find "$DIST_PATH/assets" -type f | wc -l)
        echo "    ✓ Assets directory exists with $ASSET_COUNT files"
        ls -lh "$DIST_PATH/assets/" | head -3
    else
        echo "    ✗ ERROR: Assets directory missing!"
    fi
    
    # Check for index.html
    if [ -f "$DIST_PATH/index.html" ]; then
        echo "    ✓ index.html exists ($(wc -c < $DIST_PATH/index.html) bytes)"
    else
        echo "    ✗ ERROR: index.html missing!"
    fi
else
    echo "    ✗ ERROR: $DIST_PATH does not exist"
fi

echo ""
echo "[2] Checking boot.mjs FORUM_DIST_PATH setting..."
if [ -f "$APP_PATH/boot.mjs" ]; then
    grep -A1 "FORUM_DIST_PATH" "$APP_PATH/boot.mjs" | head -2
else
    echo "    ✗ boot.mjs not found"
fi

echo ""
echo "[3] Checking environment variables in running process..."
pm2_info=$(pm2 info scootware-api 2>/dev/null | grep -i "FORUM_DIST_PATH" || echo "    (not set in PM2 env)")
echo "$pm2_info"

echo ""
echo "[4] Testing HTTP asset requests..."
# Test via curl
echo "    Testing: curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/assets/"
STATUS=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/assets/ 2>/dev/null)
echo "    Status: $STATUS (should be 200 or 301 for directory)"

echo "    Testing: curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/index.html"
STATUS=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/index.html 2>/dev/null)
echo "    Status: $STATUS (should be 200)"

echo ""
echo "[5] Checking app.ts configuration..."
grep -n "staticPath\\|FORUM_DIST_PATH\\|express.static" "$APP_PATH/artifacts/api-server/dist/index.mjs" 2>/dev/null | head -5 || echo "    (check app.ts in source)"

echo ""
echo "[6] PM2 Process Status..."
pm2 status | grep scootware-api

echo ""
echo "=== END VERIFICATION ==="
echo ""
echo "If assets are still not loading:"
echo "1. Check PM2 logs: pm2 logs scootware-api"
echo "2. Verify /home/admin/Scootware-Forum/artifacts/forum/dist/public is readable"
echo "3. Ensure boot.mjs is correctly setting FORUM_DIST_PATH"
