#!/bin/bash
set -e

# This script installs the production nginx config and restarts nginx.
# Run as root or with sudo.
# SAFEGUARDS: Checks for conflicting services, kills them, verifies nginx starts

SOURCE_CONFIG="$(dirname "$0")/nginx.conf.prod"
DEST_CONFIG="/etc/nginx/sites-available/scootware"
ENABLE_LINK="/etc/nginx/sites-enabled/scootware"

if [ ! -f "$SOURCE_CONFIG" ]; then
  echo "ERROR: Source config not found: $SOURCE_CONFIG"
  exit 1
fi

# Step 1: Identify conflicting services BEFORE killing anything
echo "=== CHECKING FOR CONFLICTING SERVICES ==="
echo "Checking ports 80 and 443 for existing services..."

CONFLICTS_80=""
CONFLICTS_443=""

if command -v fuser >/dev/null 2>&1; then
  CONFLICTS_80=$(sudo fuser 80/tcp 2>/dev/null || true)
  CONFLICTS_443=$(sudo fuser 443/tcp 2>/dev/null || true)
fi

if [ -n "$CONFLICTS_80" ]; then
  echo "⚠️  WARNING: Port 80 is in use by process(es): $CONFLICTS_80"
  PS_INFO=$(sudo ps -p "$CONFLICTS_80" -o name= 2>/dev/null || echo "unknown")
  echo "   Process name: $PS_INFO"
fi

if [ -n "$CONFLICTS_443" ]; then
  echo "⚠️  WARNING: Port 443 is in use by process(es): $CONFLICTS_443"
  PS_INFO=$(sudo ps -p "$CONFLICTS_443" -o name= 2>/dev/null || echo "unknown")
  echo "   Process name: $PS_INFO"
fi

# Step 2: Stop nginx service first (if running) before clearing ports
echo ""
echo "=== STOPPING NGINX SERVICE ==="
sudo systemctl stop nginx 2>/dev/null || echo "[INFO] Nginx not running (OK)"
sleep 1

# Step 3: Kill conflicting processes
echo ""
echo "=== CLEARING CONFLICTING PROCESSES ==="
echo "Killing any services on ports 80 and 443..."

if command -v fuser >/dev/null 2>&1; then
  sudo fuser -k 80/tcp 2>/dev/null || true
  sudo fuser -k 443/tcp 2>/dev/null || true
fi

# Also kill common conflicting services by name
sudo killall -9 nginx apache2 node nodeapp 2>/dev/null || true

# Give system time to free ports
sleep 2

# Step 4: Verify ports are now free
echo ""
echo "=== VERIFYING PORTS ARE FREE ==="
if command -v fuser >/dev/null 2>&1; then
  if ! sudo fuser 80/tcp 2>/dev/null; then
    echo "✓ Port 80 is now free"
  else
    echo "❌ ERROR: Port 80 is still in use!"
    exit 1
  fi
  
  if ! sudo fuser 443/tcp 2>/dev/null; then
    echo "✓ Port 443 is now free"
  else
    echo "❌ ERROR: Port 443 is still in use!"
    exit 1
  fi
fi

# Step 5: Deploy nginx configuration
echo ""
echo "=== DEPLOYING NGINX CONFIGURATION ==="

sudo cp "$SOURCE_CONFIG" "$DEST_CONFIG"
sudo ln -sf "$DEST_CONFIG" "$ENABLE_LINK"

# Nuke all active site links to clear any Certbot duplicates or old configs
echo "Clearing all old/duplicate Nginx configurations..."
sudo rm -f /etc/nginx/sites-enabled/*

# Link ONLY our clean production config
echo "Setting Scootware Forum as the ONLY active site..."
sudo ln -sf "$DEST_CONFIG" "$ENABLE_LINK"

# Test nginx syntax
echo ""
echo "=== TESTING NGINX SYNTAX ==="
if ! sudo nginx -t; then
  echo "❌ ERROR: Nginx configuration syntax error!"
  exit 1
fi
echo "✓ Nginx configuration is valid"

# Step 6: Start nginx and verify
echo ""
echo "=== STARTING NGINX SERVICE ==="

if ! sudo systemctl start nginx; then
  echo "❌ ERROR: Failed to start Nginx service!"
  echo ""
  echo "Checking Nginx errors:"
  sudo journalctl -xeu nginx.service | tail -30
  exit 1
fi

echo "✓ Nginx service started"

# Verify nginx is actually running
sleep 1
if sudo systemctl is-active --quiet nginx; then
  echo "✓ Nginx is running"
else
  echo "❌ ERROR: Nginx failed to stay running!"
  sudo systemctl status nginx --no-pager
  exit 1
fi

# Step 7: Verify ports are listening
echo ""
echo "=== VERIFYING PORT LISTENERS ==="

if command -v ss >/dev/null 2>&1; then
  if ss -tlnp | grep -q ':80'; then
    echo "✓ Nginx is listening on port 80"
  else
    echo "❌ WARNING: Port 80 is not listening!"
  fi
  
  if ss -tlnp | grep -q ':443'; then
    echo "✓ Nginx is listening on port 443"
  else
    echo "⚠️  Port 443 not listening (OK if SSL not configured)"
  fi
fi

echo ""
echo "✅ SUCCESS: Nginx is deployed and running! Now check http/https connectivity."
