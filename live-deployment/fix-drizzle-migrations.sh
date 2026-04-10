#!/bin/bash
# Skip Drizzle Migrations - Temporary fix for DATABASE_URL issues
# This script clears drizzle migrations and allows build to continue
# Run this on the VPS if push-force fails: bash fix-drizzle-migrations.sh

APP_PATH="/home/admin/Scootware-Forum"
cd "$APP_PATH" || exit 1

echo "=== FIXING DRIZZLE MIGRATION ISSUES ==="
echo ""

# Step 1: Unset DATABASE_URL to prevent conflicts
echo "[1/3] Clearing environment..."
unset DATABASE_URL
unset PG_CONNECTION_STRING
echo "✓ Environment cleared"

# Step 2: Re-install without running migrations
echo ""
echo "[2/3] Reinstalling dependencies..."
pnpm install
if [ $? -ne 0 ]; then
    echo "❌ pnpm install failed"
    exit 1
fi
echo "✓ Dependencies installed"

# Step 3: Run build (which should now work without DATABASE_URL)
echo ""
echo "[3/3] Building project..."
pnpm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi
echo "✓ Build completed successfully"

echo ""
echo "=== FIX COMPLETE ==="
echo ""
echo "To run database migrations later, set DATABASE_URL and run:"
echo "  export DATABASE_URL='postgresql://user:pass@host:5432/scootware'"
echo "  pnpm --filter @workspace/db run push-force"