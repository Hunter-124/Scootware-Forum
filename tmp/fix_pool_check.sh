#!/bin/bash
# Patch app.ts on VPS: fix Pool check + refine IP fallback
APP_FILE="/home/admin/Scootware-Forum/artifacts/api-server/src/app.ts"

python3 << 'PYEOF'
import re

with open('/home/admin/Scootware-Forum/artifacts/api-server/src/app.ts', 'r') as f:
    content = f.read()

# Fix the Pool check to be more lenient
old_pool_check = 'if (pool && typeof pool.query === "function" && typeof pool.end === "function" && pool.constructor?.name === "Pool") {'
new_pool_check = 'if (pool && typeof pool.query === "function" && typeof pool.end === "function") {'

if old_pool_check in content:
    content = content.replace(old_pool_check, new_pool_check)
    print("SUCCESS: Pool check loosened")
else:
    print("WARNING: Could not find Pool check block (already changed?)")

with open('/home/admin/Scootware-Forum/artifacts/api-server/src/app.ts', 'w') as f:
    f.write(content)
PYEOF

cd /home/admin/Scootware-Forum && pnpm run build && pm2 reload scootware-api
