#!/bin/bash
# Comprehensive VPS Repair and Deploy
set -e

REMOTE_PATH="/home/admin/Scootware-Forum"
cd $REMOTE_PATH

echo "1. Killing any process on port 3000..."
sudo fuser -k 3000/tcp || true

echo "2. Applying source code patches to VPS..."

# Patch app.ts
python3 << 'PYEOF'
import re
import os

app_path = '/home/admin/Scootware-Forum/artifacts/api-server/src/app.ts'
with open(app_path, 'r') as f:
    content = f.read()

# IP Fallback Logic (more robust)
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
      // Use CF-Connecting-IP if available, otherwise req.ip
      const clientIp = req.headers["cf-connecting-ip"] || req.ip;
      
      // Find latest successful login with a session from this IP in last 60 mins
      const result = await pool.query(
        "SELECT session_id FROM login_events WHERE ip = $1 AND user_agent = $2 AND session_id IS NOT NULL AND created_at > NOW() - INTERVAL '60 minutes' ORDER BY created_at DESC LIMIT 1",
        [clientIp, userAgent]
      );
      if (result.rows && result.rows.length > 0) {
        sid = result.rows[0].session_id;
        logger.info({ ip: clientIp, sid: sid.substring(0, 8) }, "IP-based session recovery successful");
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

# Replace old middleware block
pattern = r'// Support for loader/API clients.*?next\(\);\s*\}\);'
content = re.sub(pattern, new_middleware, content, flags=re.DOTALL)

# Loosen Pool check
content = content.replace('pool.constructor?.name === "Pool"', 'true')

with open(app_path, 'w') as f:
    f.write(content)
print("app.ts patched")
PYEOF

# Patch auth.ts
python3 << 'PYEOF'
import re

auth_path = '/home/admin/Scootware-Forum/artifacts/api-server/src/routes/auth.ts'
with open(auth_path, 'r') as f:
    content = f.read()

# Better SID capture
old_insert = r'await db\.insert\(loginEventsTable\)\.values\(\{.*?userId:\s*user\.id,.*?\}\)\.returning\(\);'
new_insert = '''const sid = req.session?.id || req.sessionID;
          await db.insert(loginEventsTable).values({ 
            userId: user.id, 
            ip, 
            userAgent: req.get ? req.get("user-agent") : undefined, 
            eventType: "login", 
            sessionId: sid 
          }).returning();
          req.log?.info({ userId: user.id, sid }, "Login event recorded with session");'''

content = re.sub(old_insert, new_insert, content, flags=re.DOTALL)

with open(auth_path, 'w') as f:
    f.write(content)
print("auth.ts patched")
PYEOF

echo "3. Rebuilding and Restarting..."
pnpm run build
pm2 delete scootware-api || true
pm2 start ecosystem.config.cjs --update-env

echo "4. Verification..."
sleep 5
pm2 status scootware-api
