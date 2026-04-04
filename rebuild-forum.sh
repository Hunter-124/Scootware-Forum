#!/bin/bash
# Rebuild and redeploy forum frontend

set -e

echo "==================================="
echo "Rebuilding forum frontend..."
echo "==================================="

cd /home/admin/Scootware-Forum/Scootware-Forum/artifacts/forum

pnpm install
pnpm run build

echo ""
echo "==================================="
echo "✓ Forum rebuild completed!"
echo "Restart your forum service to load the new build"
echo "==================================="
