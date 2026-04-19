#!/bin/bash
# Patch app.ts on VPS with IP-based session fallback for loader
APP_FILE="/home/admin/Scootware-Forum/artifacts/api-server/src/app.ts"

python3 << 'PYEOF'
import re

with open('/home/admin/Scootware-Forum/artifacts/api-server/src/app.ts', 'r') as f:
    content = f.read()

old_middleware = r'''// Support for loader/API clients that can't handle cookies: 
// extract session ID from Authorization header, X-Session-ID header, or query params
app.use\(\(req: any, res, next\) => \{.*?next\(\);\n\}\);'''

new_middleware = '''// Support for loader/API clients that can't handle cookies: 
// extract session ID from Authorization header, X-Session-ID header, or query params
app.use(async (req: any, res, next) => {
  const authHeader = req.headers.authorization;
  const xSid = req.headers["x-session-id"];
  const userAgent = req.headers["user-agent"];

  // Check headers first, then common query parameters used by loaders/clients
  let sid = (typeof xSid === "string" ? xSid : undefined) 
    || (authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : (authHeader && authHeader !== "undefined" ? authHeader : undefined))
    || (req.query.sid as string)
    || (req.query.token as string)
    || (req.query.session as string)
    || (req.query.session_id as string);

  // IP-based session recovery fallback for ScootwareLoader
  if (!sid && userAgent === "ScootwareLoader/1.0" && pool) {
    try {
      // Find latest successful login with a session from this IP in last 30 mins
      const result = await pool.query(
        "SELECT session_id FROM login_events WHERE ip = $1 AND user_agent = $2 AND session_id IS NOT NULL AND created_at > NOW() - INTERVAL '30 minutes' ORDER BY created_at DESC LIMIT 1",
        [req.ip, userAgent]
      );
      if (result.rows && result.rows.length > 0) {
        sid = result.rows[0].session_id;
        logger.info({ ip: req.ip, sid: sid.substring(0, 8) }, "IP-based session recovery successful");
      }
    } catch (err) {
      logger.error({ err }, "IP-based session recovery failed");
    }
  }

  // Log all requests to /api/products to debug loader auth
  if (req.url && req.url.includes("/products/")) {
    logger.info({
      url: req.url,
      headers: req.headers,
      query: req.query,
      sidFound: !!sid
    }, "VERBOSE Loader session middleware check");
  }

  if (sid && sid !== "undefined" && sid !== "null" && (!req.headers.cookie || !req.headers.cookie.includes("connect.sid"))) {
    // If the SID is not signed (doesn't start with s:), sign it so express-session accepts it
    if (!sid.startsWith("s:")) {
      const secret = process.env.SESSION_SECRET || "dev-secret-do-not-use-in-production";
      const signature = crypto
        .createHmac("sha256", secret)
        .update(sid)
        .digest("base64")
        .replace(/\=+$/, "");
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

# Use re.DOTALL to match across multiple lines
if re.search(old_middleware, content, re.DOTALL):
    content = re.sub(old_middleware, new_middleware, content, flags=re.DOTALL)
    with open('/home/admin/Scootware-Forum/artifacts/api-server/src/app.ts', 'w') as f:
        f.write(content)
    print("SUCCESS: app.ts patched with IP fallback")
else:
    print("ERROR: Could not find the old middleware block")
    # Debug: show start of middleware area
    start = content.find("// Support for loader")
    if start != -1:
        print("Found start:")
        print(content[start:start+200])
PYEOF

cd /home/admin/Scootware-Forum && pnpm run build && pm2 reload scootware-api
