#!/bin/bash
set -e
cd /home/admin/Scootware-Forum

echo "[SAFETY] Backing up DATABASE_URL..."
OLD_DB_URL=""
if [ -f .env ]; then
    OLD_DB_URL=$(grep '^DATABASE_URL=' .env | head -1)
fi

echo "Extracting archive..."
tar -xzf project.tar.gz
rm -f project.tar.gz

echo "[SAFETY] Restoring DATABASE_URL..."
if [ -n "$OLD_DB_URL" ]; then
    sed -i '/^DATABASE_URL=/d' .env 2>/dev/null || true
    echo "$OLD_DB_URL" >> .env
    echo "  DATABASE_URL restored"
fi

echo "Running full deploy (update + build + restart + migration)..."
bash live-deployment/remote-manage.sh all
