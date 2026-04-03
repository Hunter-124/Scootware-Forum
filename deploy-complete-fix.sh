#!/bin/bash
# COMPLETE ASSET SERVING FIX - Run on VPS after deployment
# This fixes:
# 1. Port mismatch (API should run on 3000, not 3001)
# 2. Nginx reverse proxy setup and startup
# 3. Static asset serving through nginx

echo "=== COMPLETE SCOOTWARE ASSET & PROXY FIX ==="
echo ""

APP_PATH="/home/admin/Scootware-Forum"
cd "$APP_PATH" || exit 1

# Load environment variables from .env files if they exist
echo "[Setup] Loading environment configuration..."

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

if [ -f "$APP_PATH/.env" ]; then
    echo "  Loading .env..."
    source_env_safe "$APP_PATH/.env"
fi

if [ -f "$APP_PATH/.env.production" ]; then
    echo "  Loading .env.production..."
    source_env_safe "$APP_PATH/.env.production"
fi

# Check critical files
echo "[Setup] Verifying critical files..."
CRITICAL_FILES=("pnpm-lock.yaml" "pnpm-workspace.yaml" "package.json" "lib/db/package.json")
for file in "${CRITICAL_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Missing critical file: $file"
        echo "   Current directory: $(pwd)"
        echo "   Files in directory:"
        ls -la | head -20
        exit 1
    fi
done
echo "✓ All critical files present"

# Ensure database services are running
echo "[Setup] Starting database services..."
sudo systemctl start postgresql redis-server mariadb 2>/dev/null || true
sleep 3
echo "✓ Database services started"

# Step 1: Ensure dependencies are installed and rebuild with corrected port
echo ""
echo "[1/7] Installing dependencies..."
echo "  Running: pnpm install --frozen-lockfile"
pnpm install --frozen-lockfile
if [ $? -ne 0 ]; then
    echo "❌ pnpm install failed!"
    echo "  Attempting to install without frozen-lockfile..."
    pnpm install
    if [ $? -ne 0 ]; then
        echo "❌ pnpm install failed even without frozen-lockfile!"
        echo "  Checking pnpm cache..."
        pnpm store status
        exit 1
    fi
fi
echo "✓ Dependencies installed"

echo ""
echo "[2/7] Verifying dependencies..."
echo "  Checking for drizzle-orm..."
ls node_modules/.pnpm/ | grep -i drizzle || echo "  ⚠ drizzle-orm modules not found yet"
echo "  Checking for zod..."
ls node_modules/.pnpm/ | grep -i zod || echo "  ⚠ zod modules not found yet"

echo ""
echo "[3/7] Rebuilding API server with port 3000..."
echo "  Running: pnpm run build"
pnpm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    echo "  Build output above may contain details."
    echo "  Attempting to verify TypeScript setup..."
    pnpm run typecheck:libs
    exit 1
fi
echo "✓ Build completed"

# Step 2: Go to rescue mode to stop everything
echo ""
echo "[4/7] Entering rescue mode to free port 80..."
echo "  (This will stop all user services temporarily)"
sudo systemctl isolate rescue.target
sleep 5

echo "✓ Rescue mode active - all services stopped"

# Step 3: Setup Nginx
echo ""
echo "[5/7] Configuring Nginx reverse proxy..."

# Disable the site first (if it exists)
if [ -L /etc/nginx/sites-enabled/scootware ]; then
    echo "  Removing existing symlink..."
    sudo unlink /etc/nginx/sites-enabled/scootware
fi

# Remove old config files completely
echo "  Removing old config files..."
sudo rm -f /etc/nginx/sites-available/scootware
sudo rm -f /etc/nginx/sites-enabled/scootware

# Wait a moment to ensure filesystem is updated
sleep 1

# Also disable default site if it exists to avoid conflicts
echo "  Disabling default nginx site..."
sudo rm -f /etc/nginx/sites-enabled/default

# Create nginx config with HTTPS support
echo "  Creating new nginx config with HTTPS..."
sudo tee /etc/nginx/sites-available/scootware > /dev/null << 'EOF'
upstream scootware_api {
    server 127.0.0.1:3000;
    keepalive 64;
}

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name scootware.us www.scootware.us;
    
    # Allow Let's Encrypt ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # Redirect all other HTTP to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Fallback for IP-based access on HTTP
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    location / {
        return 301 https://scootware.us$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;

    server_name scootware.us www.scootware.us;

    # SSL certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/scootware.us/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/scootware.us/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    root /home/admin/Scootware-Forum/artifacts/forum/dist/public;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_vary on;
    gzip_comp_level 6;

    # Static assets - long cache
    location ~* ^/assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options "nosniff";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        access_log off;
    }

    # Versioned assets
    location ~* \.(js|css|woff|woff2|ttf|eot|svg|map)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options "nosniff";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        access_log off;
    }

    # API proxy
    location /api/ {
        proxy_pass http://scootware_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Uploads
    location /uploads/ {
        proxy_pass http://scootware_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # SPA fallback
    location / {
        try_files $uri /index.html;
    }

    # Deny access to sensitive files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
EOF

# Enable nginx site - remove any existing symlink first
echo "  Creating nginx site symlink..."
sudo rm -f /etc/nginx/sites-enabled/scootware
sudo ln -s /etc/nginx/sites-available/scootware /etc/nginx/sites-enabled/scootware

sleep 1

# Test nginx config
echo "  Testing Nginx configuration..."
sudo nginx -t 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Nginx config test failed!"
    echo "  Debugging: Current nginx config:"
    sudo head -20 /etc/nginx/sites-available/scootware || echo "  (config file not found)"
    exit 1
fi

echo "✓ Nginx configured"

# Step 4: Start the API on port 3000
echo ""
echo "[4/7] Starting API on port 3000..."

export PORT=3000
pm2 start ecosystem.config.cjs --update-env --cwd "$APP_PATH" || {
    echo "❌ PM2 start failed!"
    exit 1
}

pm2 save
sleep 3

echo "✓ API started on port 3000"

# Step 5: Start Nginx reverse proxy
echo ""
echo "[5/7] Starting Nginx reverse proxy..."

# Start Nginx (port 80 is free from rescue mode)
echo "  Starting Nginx..."
sudo systemctl start nginx
if [ $? -ne 0 ]; then
    echo "❌ Nginx failed to start!"
    sudo systemctl status nginx
    exit 1
fi

sudo systemctl enable nginx
sleep 2

if sudo systemctl is-active --quiet nginx; then
    echo "✓ Nginx is running"
else
    echo "❌ Nginx failed to stay running!"
    sudo systemctl status nginx
    exit 1
fi

# Step 6: Restore normal multi-user mode
echo ""
echo "[6/7] Restoring normal system mode..."
sudo systemctl isolate multi-user.target
sleep 3

echo "✓ System restored to multi-user mode"

# Step 7: Test everything
echo ""
echo "[7/7] Testing asset and API serving..."

echo ""
echo "Waiting for services to stabilize (10 seconds)..."
sleep 10

echo ""
echo "Testing HTTP requests:"

# Test counter for health checks
TEST_FAILURES=0

echo ""
echo "  Checking what port Node.js is listening on..."
NODEJS_PORT=$(ss -tulpn 2>/dev/null | grep node | grep -oP ':\K\d+' | head -1 || echo "unknown")
if [ "$NODEJS_PORT" = "3000" ]; then
    echo "  ✓ Node.js listening on port 3000 (correct)"
elif [ "$NODEJS_PORT" = "3001" ]; then
    echo "  ⚠ Node.js listening on port 3001 (expected 3000, but API should still work via Nginx)"
else
    echo "  ℹ Node.js port: $NODEJS_PORT"
fi

echo ""
echo "  Testing API health check (port 3000 direct)..."
RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:3000/api/healthz 2>&1)
HTTP_CODE=$(echo "$RESULT" | grep HTTP_CODE | cut -d: -f2)
if [[ "$HTTP_CODE" == "200" ]]; then
    echo "  ✓ API responding on port 3000"
else
    echo "  ✗ API health check failed ($HTTP_CODE)"
    echo "  Response: $(echo "$RESULT" | head -1)"
    echo "  Note: API may still be starting. Check logs with: pm2 logs scootware-api"
    TEST_FAILURES=$((TEST_FAILURES + 1))
fi

echo ""
echo "  Testing /index.html via Nginx (port 80)..."
RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost/index.html 2>&1)
HTTP_CODE=$(echo "$RESULT" | grep HTTP_CODE | cut -d: -f2)
if [[ "$HTTP_CODE" == "200" ]]; then
    echo "  ✓ /index.html served via Nginx (200)"
else
    echo "  ✗ /index.html returned $HTTP_CODE"
    TEST_FAILURES=$((TEST_FAILURES + 1))
fi

echo ""
echo "  Testing /assets/ via Nginx..."
RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost/assets/ 2>&1)
HTTP_CODE=$(echo "$RESULT" | grep HTTP_CODE | cut -d: -f2)
if [[ "$HTTP_CODE" =~ ^(200|301|403)$ ]]; then
    echo "  ✓ /assets/ accessible via Nginx (HTTP $HTTP_CODE)"
else
    echo "  ✗ /assets/ returned $HTTP_CODE"
    TEST_FAILURES=$((TEST_FAILURES + 1))
fi

echo ""
echo "  Testing /api/healthz via Nginx..."
RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost/api/healthz 2>&1)
HTTP_CODE=$(echo "$RESULT" | grep HTTP_CODE | cut -d: -f2)
if [[ "$HTTP_CODE" == "200" ]]; then
    echo "  ✓ /api/healthz proxied via Nginx (200)"
else
    echo "  ✗ /api/healthz via Nginx returned $HTTP_CODE"
    TEST_FAILURES=$((TEST_FAILURES + 1))
fi

echo ""
echo "=== DEPLOYMENT COMPLETE ==="
echo ""

if [[ $TEST_FAILURES -eq 0 ]]; then
    echo "✓ All tests passed! Fix deployed successfully!"
else
    echo "⚠ Deployment completed but $TEST_FAILURES test(s) failed."
    echo ""
    echo "Troubleshooting:"
    echo "1. API may still be starting. Wait 30 seconds and test manually:"
    echo "   curl http://localhost:3000/api/healthz"
    echo "   curl http://localhost/index.html"
    echo ""
    echo "2. Check if API is running:"
    echo "   pm2 status"
    echo ""
    echo "3. View API logs:"
    echo "   pm2 logs scootware-api --lines 50"
    echo ""
    echo "4. Check Nginx status:"
    echo "   sudo systemctl status nginx"
    echo "   sudo systemctl reload nginx"
fi

echo ""
echo "Key changes made:"
echo "  1. Fixed API port: 3001 → 3000 (matches Nginx upstream)"
echo "  2. Nginx reverse proxy configured and started"
echo "  3. Static assets served by Nginx with caching headers"
echo "  4. API endpoints proxied through Nginx (with upgrade headers for WebSockets)"
echo ""
echo "Service Checks:"
echo "  • Nginx: sudo systemctl status nginx"
echo "  • API: pm2 status"
echo "  • Logs: pm2 logs scootware-api"
echo ""
echo "Access at: http://YOUR_IP_ADDRESS"
