#!/bin/bash
set -euo pipefail

# setup-https.sh - configure HTTPS for Scootware Forum deployment
# Intended for VPS (run as root or via sudo)

DOMAIN="scootware.us"
WWW_DOMAIN="www.scootware.us"
NGINX_SITE=/etc/nginx/sites-available/scootware
SSL_DIR=/etc/letsencrypt/live/$DOMAIN
SELF_SIGNED_DIR=/etc/nginx/ssl

# 1) Ensure nginx site is enabled
if [ ! -f "$NGINX_SITE" ]; then
  echo "ERROR: Nginx site config not found at $NGINX_SITE"
  echo "Make sure you have uploaded live-deployment/nginx.conf.prod to this path."
  exit 1
fi

if [ ! -L "/etc/nginx/sites-enabled/scootware" ]; then
  echo "Enabling scootware site in nginx..."
  ln -s "$NGINX_SITE" /etc/nginx/sites-enabled/scootware
fi

# 2) Install certbot if missing
if ! command -v certbot >/dev/null 2>&1; then
  apt-get update
  apt-get install -y certbot python3-certbot-nginx
fi

# 3) Attempt Let’s Encrypt HTTPS if possible
if [ -f "$SSL_DIR/fullchain.pem" ] && [ -f "$SSL_DIR/privkey.pem" ]; then
  echo "Let’s Encrypt cert already exists at $SSL_DIR"
else
  echo "Requesting Let’s Encrypt certificates for $DOMAIN and $WWW_DOMAIN..."
  certbot --nginx --non-interactive --agree-tos -m admin@$DOMAIN -d $DOMAIN -d $WWW_DOMAIN --redirect
fi

# 4) If certbot could not provision, create a self-signed cert so port 443 opens
if [ ! -f "$SSL_DIR/fullchain.pem" ] || [ ! -f "$SSL_DIR/privkey.pem" ]; then
  echo "Falling back to self-signed certificate to keep HTTPS port open..."
  mkdir -p "$SELF_SIGNED_DIR"
  openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
    -keyout "$SELF_SIGNED_DIR/scootware.key" \
    -out "$SELF_SIGNED_DIR/scootware.crt" \
    -subj "/CN=$DOMAIN/O=Scootware/OU=IT/C=US"
  sed -ri 's|ssl_certificate .*|ssl_certificate /etc/nginx/ssl/scootware.crt;|g' "$NGINX_SITE"
  sed -ri 's|ssl_certificate_key .*|ssl_certificate_key /etc/nginx/ssl/scootware.key;|g' "$NGINX_SITE"
fi

# 5) Apply our robust Nginx configuration and clear Certbot ghost duplicates
echo "Applying robust Nginx production config and restarting..."
sudo bash "$(dirname "$0")/apply-nginx-https.sh"

# 6) Validate
echo "Done. Check HTTPS status:"
curl -Ik https://$DOMAIN/ || true
curl -Ik https://$WWW_DOMAIN/ || true
curl -Ik https://[VPS_IP]/ || true
