#!/bin/bash
set -e

# This script installs the production nginx config and restarts nginx.
# Run as root or with sudo.

SOURCE_CONFIG="$(dirname "$0")/nginx.conf.prod"
DEST_CONFIG="/etc/nginx/sites-available/scootware"
ENABLE_LINK="/etc/nginx/sites-enabled/scootware"

if [ ! -f "$SOURCE_CONFIG" ]; then
  echo "ERROR: Source config not found: $SOURCE_CONFIG"
  exit 1
fi

sudo cp "$SOURCE_CONFIG" "$DEST_CONFIG"
sudo ln -sf "$DEST_CONFIG" "$ENABLE_LINK"

# Nuke all active site links to clear any Certbot duplicates or old configs
echo "Clearing all old/duplicate Nginx configurations..."
sudo rm -f /etc/nginx/sites-enabled/*

# Link ONLY our clean production config
echo "Setting Scootware Forum as the ONLY active site..."
sudo ln -sf "$DEST_CONFIG" "$ENABLE_LINK"

echo "Checking Nginx syntax..."
sudo nginx -t

echo "Forcefully clearing ports 80 and 443 in case of hung ghost processes..."
sudo fuser -k 80/tcp 2>/dev/null || true
sudo fuser -k 443/tcp 2>/dev/null || true
sudo killall -9 nginx apache2 2>/dev/null || true

echo "Starting Nginx securely..."
sudo systemctl start nginx
sudo systemctl status nginx --no-pager

echo "✅ Deployed nginx production config. Now check http and https connectivity."
