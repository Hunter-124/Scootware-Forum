#!/bin/bash
echo "=== app.ts lines 170-210 on VPS ==="
sed -n '165,215p' /home/admin/Scootware-Forum/artifacts/api-server/src/app.ts

echo ""
echo "=== CWD for pm2 process ==="
pm2 env 0 2>/dev/null | grep -E "pm_cwd|cwd|exec_path|script"

echo ""
echo "=== Check uploads resolve path ==="
# The PRODUCT_ASSETS_DIR in productAssets.ts does path.resolve("uploads/product_assets")
# So it resolves relative to CWD of the process
node -e "process.chdir('/home/admin/Scootware-Forum/artifacts/api-server'); const path = require('path'); console.log(path.resolve('uploads/product_assets'));" 2>/dev/null
node -e "process.chdir('/home/admin/Scootware-Forum'); const path = require('path'); console.log(path.resolve('uploads/product_assets'));" 2>/dev/null
