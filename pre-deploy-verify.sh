#!/bin/bash
# Pre-deployment Asset Verification Script
# Run this BEFORE deploying to ensure all assets are correctly built

echo "=== PRE-DEPLOYMENT ASSET VERIFICATION ==="
echo ""

# Check 1: Verify node_modules exist
echo "[1] Checking if dependencies are installed..."
if [ -d "node_modules" ]; then
    echo "    ✓ node_modules exists"
else
    echo "    ✗ node_modules missing - run 'pnpm install' first"
    exit 1
fi

# Check 2: Verify forum dist exists and has assets
echo "[2] Checking forum build artifacts..."
FORUM_DIST="artifacts/forum/dist/public"

if [ ! -d "$FORUM_DIST" ]; then
    echo "    ✗ $FORUM_DIST does not exist"
    echo "    → Run 'pnpm run build' to generate build artifacts"
    exit 1
fi

if [ ! -d "$FORUM_DIST/assets" ]; then
    echo "    ✗ Asset directory missing at $FORUM_DIST/assets"
    echo "    → Build artifacts incomplete - run 'pnpm run build'"
    exit 1
fi

ASSET_COUNT=$(find "$FORUM_DIST/assets" -type f | wc -l)
if [ $ASSET_COUNT -lt 2 ]; then
    echo "    ✗ Only $ASSET_COUNT asset files found (expected at least 2 - CSS and JS)"
    exit 1
fi

echo "    ✓ $FORUM_DIST/assets contains $ASSET_COUNT files"
ls -lh "$FORUM_DIST/assets/" | head -3

# Check 3: Verify index.html
echo ""
echo "[3] Checking index.html..."
if [ ! -f "$FORUM_DIST/index.html" ]; then
    echo "    ✗ index.html missing!"
    exit 1
fi

FILE_SIZE=$(stat -f%z "$FORUM_DIST/index.html" 2>/dev/null || stat -c%s "$FORUM_DIST/index.html")
if [ $FILE_SIZE -lt 500 ]; then
    echo "    ✗ index.html seems incomplete ($FILE_SIZE bytes)"
    exit 1
fi

echo "    ✓ index.html exists ($FILE_SIZE bytes)"

# Check 4: Verify API server dist
echo ""
echo "[4] Checking API server build artifacts..."
if [ ! -f "artifacts/api-server/dist/index.mjs" ]; then
    echo "    ✗ API server build missing"
    exit 1
fi

echo "    ✓ artifacts/api-server/dist/index.mjs exists"

# Check 5: Look for asset references in HTML
echo ""
echo "[5] Checking asset references in index.html..."
ASSET_REFS=$(grep -c "assets/" "$FORUM_DIST/index.html" || echo "0")
echo "    ✓ Found $ASSET_REFS references to /assets/ in HTML"

if grep -q "\.css" "$FORUM_DIST/index.html"; then
    echo "    ✓ CSS file references found"
else
    echo "    ⚠ No CSS references found - check build output"
fi

if grep -q "\.js" "$FORUM_DIST/index.html"; then
    echo "    ✓ JavaScript file references found"  
else
    echo "    ⚠ No JS references found - check build output"
fi

echo ""
echo "=== VERIFICATION COMPLETE ==="
echo ""
echo "✓ Build artifacts are ready for deployment"
echo "You can now deploy via the GUI tool."
echo ""
echo "After deployment, run on server: bash verify-assets.sh"
