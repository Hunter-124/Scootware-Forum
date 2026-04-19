#!/bin/bash
# Patch the app.ts on VPS to add verbose logging to the session middleware
# This will help us see exactly what the loader is sending

APP_FILE="/home/admin/Scootware-Forum/artifacts/api-server/src/app.ts"

# Backup
cp "$APP_FILE" "${APP_FILE}.bak"

# Replace the old minimal middleware with one that logs what it sees
python3 << 'PYEOF'
import re

with open('/home/admin/Scootware-Forum/artifacts/api-server/src/app.ts', 'r') as f:
    content = f.read()

old_middleware = '''// Support for loader/API clients that can't handle cookies: 
// extract session ID from Authorization header or X-Session-ID header
app.use((req: any, res, next) => {
  const authHeader = req.headers.authorization;
  const xSid = req.headers["x-session-id"];
  let sid = (typeof xSid === "string" ? xSid : undefined) || (authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined);

  if (sid && (!req.headers.cookie || !req.headers.cookie.includes("connect.sid"))) {
    // If the SID is not signed (doesn't start with s:), sign it so express-session accepts it
    if (!sid.startsWith("s:")) {
      const secret = process.env.SESSION_SECRET || "dev-secret-do-not-use-in-production";
      const signature = crypto
        .createHmac("sha256", secret)
        .update(sid)
        .digest("base64")
        .replace(/\\=+$/, "");
      sid = `s:${sid}.${signature}`;
    }
    
    const cookieStr = `connect.sid=${sid}`;
    req.headers.cookie = req.headers.cookie ? `${cookieStr}; ${req.headers.cookie}` : cookieStr;
  }
  next();
});'''

new_middleware = '''// Support for loader/API clients that can't handle cookies: 
// extract session ID from Authorization header, X-Session-ID header, or query params
app.use((req: any, res, next) => {
  const authHeader = req.headers.authorization;
  const xSid = req.headers["x-session-id"];
  // Check headers first, then common query parameters used by loaders/clients
  let sid = (typeof xSid === "string" ? xSid : undefined) 
    || (authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader)
    || (req.query.sid as string)
    || (req.query.token as string)
    || (req.query.session as string)
    || (req.query.session_id as string);

  // Log all requests to /api/products to debug loader auth
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
  }

  if (sid && sid !== "undefined" && sid !== "null" && (!req.headers.cookie || !req.headers.cookie.includes("connect.sid"))) {
    // If the SID is not signed (doesn't start with s:), sign it so express-session accepts it
    if (!sid.startsWith("s:")) {
      const secret = process.env.SESSION_SECRET || "dev-secret-do-not-use-in-production";
      const signature = crypto
        .createHmac("sha256", secret)
        .update(sid)
        .digest("base64")
        .replace(/\\=+$/, "");
      sid = `s:${sid}.${signature}`;
    }
    
    const cookieStr = `connect.sid=${sid}`;
    req.headers.cookie = req.headers.cookie ? `${cookieStr}; ${req.headers.cookie}` : cookieStr;
    
    if (req.url && req.url.includes("/products/")) {
      logger.info({ cookieSet: cookieStr.substring(0, 50) }, "Loader session cookie injected");
    }
  }
  next();
});'''

if old_middleware in content:
    content = content.replace(old_middleware, new_middleware)
    with open('/home/admin/Scootware-Forum/artifacts/api-server/src/app.ts', 'w') as f:
        f.write(content)
    print("SUCCESS: app.ts patched")
else:
    print("ERROR: Could not find the old middleware to replace")
    # Show what's there
    import re
    m = re.search(r'Support for loader.*?next\(\);\n\}\);', content, re.DOTALL)
    if m:
        print("Found similar block:")
        print(m.group(0)[:500])
PYEOF

echo ""
echo "=== Also patch productAssets.ts to add logging ==="
python3 << 'PYEOF'
with open('/home/admin/Scootware-Forum/artifacts/api-server/src/routes/productAssets.ts', 'r') as f:
    content = f.read()

old_fn = '''// Middleware: Check if user has active product subscription
async function requireProductSubscription(req: Request, res: Response, next: any) {
  const user = req.user as any;'''

new_fn = '''// Middleware: Check if user has active product subscription
async function requireProductSubscription(req: Request, res: Response, next: any) {
  req.log?.info({ 
    url: req.originalUrl, 
    isAuthed: req.isAuthenticated ? req.isAuthenticated() : false,
    user: req.user ? (req.user as any).username : "null",
    hasCookie: !!(req.headers && req.headers.cookie),
    hasAuthHeader: !!(req.headers && req.headers.authorization),
  }, "requireProductSubscription check");

  const user = req.user as any;'''

if old_fn in content:
    content = content.replace(old_fn, new_fn)
    with open('/home/admin/Scootware-Forum/artifacts/api-server/src/routes/productAssets.ts', 'w') as f:
        f.write(content)
    print("SUCCESS: productAssets.ts patched")
else:
    print("ERROR: Could not find the old function to replace - showing first 300 chars of area:")
    idx = content.find("requireProductSubscription")
    if idx != -1:
        print(content[max(0,idx-50):idx+300])
PYEOF
