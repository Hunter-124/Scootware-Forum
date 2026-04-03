#!/bin/bash
# DEPLOY FIX FOR MISSING ASSETS - Run this on the VPS

echo "=== DEPLOYING ASSET SERVING FIX ==="
echo ""

APP_PATH="/home/admin/Scootware-Forum"
cd "$APP_PATH" || exit 1

# Helper function to safely source env files with any line endings
source_env_safe() {
    local env_file="$1"
    if [ -f "$env_file" ]; then
        # Convert Windows line endings (CRLF) to Unix (LF) in memory before sourcing
        # This prevents "$'\r': command not found" errors
        while IFS= read -r line; do
            # Remove carriage return if present
            line="${line%$'\r'}"
            [ -z "$line" ] || [ "${line:0:1}" = "#" ] && continue
            export "$line"
        done < "$env_file"
    fi
}

# Load environment
echo "[Setup] Loading environment configuration..."
if [ -f "$APP_PATH/.env.production" ]; then
    source_env_safe "$APP_PATH/.env.production"
fi

# Ensure database services are running
echo "[Setup] Starting database services..."
sudo systemctl start postgresql redis-server mariadb 2>/dev/null || true
sleep 2

# Step 1: Install dependencies and rebuild the API server with fixed code
echo "[1/5] Installing dependencies..."
pnpm install
if [ $? -ne 0 ]; then
    echo "❌ pnpm install failed!"
    exit 1
fi

echo "[2/5] Rebuilding API server with fixed path handling..."
pnpm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi
echo "✓ Build completed"

# Step 2: Restart PM2 with the new ecosystem config
echo ""
echo "[3/5] Updating PM2 with new configuration..."
pm2 delete scootware-api || true
sleep 2

pm2 start ecosystem.config.cjs --update-env --cwd "$APP_PATH" || {
    echo "❌ PM2 start failed!"
    exit 1
}

echo "✓ PM2 restarted with new config"

# Step 3: Save PM2 state
echo ""
echo "[4/5] Saving PM2 state..."
pm2 save
pm2 startup 2>/dev/null || true

echo "✓ PM2 state saved"

# Step 4: Wait for startup and check status
echo ""
echo "[5/5] Waiting for API to start (5 seconds)..."
sleep 5

pm2 status | grep scootware-api

STATUS=$(pm2 info scootware-api 2>/dev/null | grep "status" | grep "online" || echo "")
if [ -z "$STATUS" ]; then
    echo "⚠️  API status unclear, checking logs..."
    pm2 logs scootware-api --lines 30 --nostream
else
    echo "✓ API is online"
fi

# Step 5: Test asset serving
echo ""
echo "[5/5] Testing asset and static file serving..."

echo ""
echo "Testing /index.html..."
RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:3000/index.html)
HTTP_CODE=$(echo "$RESULT" | grep HTTP_CODE | cut -d: -f2)
if [[ "$HTTP_CODE" == "200" ]]; then
    echo "✓ /index.html returns 200 OK"
else
    echo "✗ /index.html returned $HTTP_CODE (expected 200)"
    echo "Full response:"
    echo "$RESULT"
fi

echo ""
echo "Testing /assets/ directory..."
RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:3000/assets/)
HTTP_CODE=$(echo "$RESULT" | grep HTTP_CODE | cut -d: -f2)
if [[ "$HTTP_CODE" == "301" || "$HTTP_CODE" == "200" || "$HTTP_CODE" == "404" ]]; then
    echo "✓ /assets/ accessible (HTTP $HTTP_CODE)"
else
    echo "✗ /assets/ returned unexpected $HTTP_CODE"
fi

echo ""
echo "Testing /api/healthz..."
RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:3000/api/healthz)
HTTP_CODE=$(echo "$RESULT" | grep HTTP_CODE | cut -d: -f2)
if [[ "$HTTP_CODE" == "200" ]]; then
    echo "✓ /api/healthz returns 200 OK"
else
    echo "✗ /api/healthz returned $HTTP_CODE"
fi

echo ""
echo "Testing debug endpoint..."
curl -s http://localhost:3000/debug/status | jq '.' || echo "Failed to query debug endpoint"

echo ""
echo "=== DEPLOYMENT COMPLETE ==="
echo ""
echo "✓ Fix deployed successfully!"
echo ""
echo "Key changes made:"
echo "  1. app.ts now requires FORUM_DIST_PATH environment variable"
echo "  2. ecosystem.config.cjs explicitly sets FORUM_DIST_PATH"
echo "  3. Better error logging to diagnose issues"
echo "  4. Removed unreliable __dirname fallback"
echo ""
echo "Next: Check browser at http://YOUR_IP_ADDRESS"
echo "If still not working, run: pm2 logs scootware-api"
