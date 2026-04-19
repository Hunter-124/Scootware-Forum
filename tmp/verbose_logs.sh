#!/bin/bash
# Update app.ts on VPS to log all headers for product requests
APP_FILE="/home/admin/Scootware-Forum/artifacts/api-server/src/app.ts"

python3 << 'PYEOF'
import re

with open('/home/admin/Scootware-Forum/artifacts/api-server/src/app.ts', 'r') as f:
    content = f.read()

# Replace the diagnostic logging part to include all headers
old_log = '''  // Log all requests to /api/products to debug loader auth
  if (req.url && req.url.includes("/products/")) {
    logger.info({
      url: req.url,
      hasCookie: !!(req.headers.cookie && req.headers.cookie.includes("connect.sid")),
      hasAuthHeader: !!authHeader,
      authHeaderPrefix: authHeader ? authHeader.substring(0, 20) : null,
      hasXSid: !!xSid,
      sidFound: !!sid,
      sidPrefix: sid ? sid.substring(0, 20) : null,
    }, "Loader session middleware check");
  }'''

new_log = '''  // Log all requests to /api/products to debug loader auth
  if (req.url && req.url.includes("/products/")) {
    logger.info({
      url: req.url,
      headers: req.headers,
      query: req.query
    }, "VERBOSE Loader session middleware check");
  }'''

if old_log in content:
    content = content.replace(old_log, new_log)
    with open('/home/admin/Scootware-Forum/artifacts/api-server/src/app.ts', 'w') as f:
        f.write(content)
    print("SUCCESS: app.ts patched for verbose logging")
else:
    print("ERROR: Could not find the old logging block")
PYEOF

cd /home/admin/Scootware-Forum && pnpm run build && pm2 reload scootware-api
