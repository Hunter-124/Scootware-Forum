#!/bin/bash

# Scootware Forum - Automated Deployment Script (Bash)
# Usage: bash deploy.sh

VPS_IP="[VPS_IP]"
REMOTE_USER="admin"
REMOTE_PATH="/home/admin/scootware-forum"
TEMP_ARCHIVE="deploy.tar.gz"

echo -e "\033[0;36m--- Starting Scootware Forum Deployment ---\033[0m"

# 1. Clean up local state
echo "[1/6] Cleaning local artifacts..."
rm -f "$TEMP_ARCHIVE"

# 2. Package current version
echo "[2/6] Creating deployment archive..."
tar --exclude='node_modules' --exclude='.git' --exclude='.pnpm-store' --exclude='dist' --exclude='.pglite-data' -czf "$TEMP_ARCHIVE" .

# 3. Upload to VPS
echo "[3/6] Uploading to $VPS_IP..."
scp "$TEMP_ARCHIVE" "${REMOTE_USER}@${VPS_IP}:/tmp/"

# 4. Remote Execution
echo "[4/6] Starting database services..."
ssh "${REMOTE_USER}@${VPS_IP}" "sudo systemctl start postgresql redis-server mariadb 2>/dev/null; sleep 2"

echo "[5/6] Executing remote update commands..."
ssh "${REMOTE_USER}@${VPS_IP}" <<'EOFSH'
    cd "$REMOTE_PATH"
    # Move the archive
    mv /tmp/deploy.tar.gz .
    # Extract and overwrite
    tar -xzf deploy.tar.gz --overwrite
    rm deploy.tar.gz

    # Load environment safely (handles Windows line endings)
    source_env_safe() {
        local env_file="$1"
        if [ -f "$env_file" ]; then
            while IFS= read -r line; do
                line="${line%$'\r'}"
                [ -z "$line" ] || [ "${line:0:1}" = "#" ] && continue
                export "$line"
            done < "$env_file"
        fi
    }

    # Load .env files
    if [ -f .env.production ]; then
        source_env_safe .env.production
    fi

    # Install & Build
    export PATH="$PATH:/home/admin/.local/share/pnpm"
    pnpm install
    pnpm run build

    # Reload service
    pm2 reload scootware-api --update-env || pm2 start artifacts/api-server/dist/index.mjs --name 'scootware-api'

    # Reload Nginx
    sudo systemctl reload nginx
EOFSH

# 5. Cleanup
echo "[6/6] Final cleanup..."
rm -f "$TEMP_ARCHIVE"

echo -e "\033[0;32m✓ Deployment completed successfully!\033[0m"

echo -e "\n\033[0;32mDEPLOYMENT COMPLETE: Scootware Forum is live at http://$VPS_IP\033[0m"
