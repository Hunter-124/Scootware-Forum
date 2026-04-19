#!/bin/bash
# Patch auth.ts on VPS to save sessionID in login_events
AUTH_FILE="/home/admin/Scootware-Forum/artifacts/api-server/src/routes/auth.ts"

python3 << 'PYEOF'
import re

with open('/home/admin/Scootware-Forum/artifacts/api-server/src/routes/auth.ts', 'r') as f:
    content = f.read()

# Find the login event insert and add session_id
old_insert = '''        await db.insert(loginEventsTable).values({
          userId: user.id,
          ip,
          userAgent: req.headers["user-agent"] || null,
        });'''

new_insert = '''        await db.insert(loginEventsTable).values({
          userId: user.id,
          ip,
          userAgent: req.headers["user-agent"] || null,
          sessionId: req.sessionID,
        });'''

if old_insert in content:
    content = content.replace(old_insert, new_insert)
    with open('/home/admin/Scootware-Forum/artifacts/api-server/src/routes/auth.ts', 'w') as f:
        f.write(content)
    print("SUCCESS: auth.ts patched to save session_id")
else:
    # Try different whitespace variant
    old_insert_alt = '''        await db.insert(loginEventsTable).values({
          userId: user.id,
          ip,
          userAgent: req.headers["user-agent"] || null
        });'''
    if old_insert_alt in content:
        content = content.replace(old_insert_alt, new_insert)
        with open('/home/admin/Scootware-Forum/artifacts/api-server/src/routes/auth.ts', 'w') as f:
            f.write(content)
        print("SUCCESS: auth.ts patched to save session_id (alt)")
    else:
        print("ERROR: Could not find the login event insert block")
        # Show what's there
        start = content.find("db.insert(loginEventsTable)")
        if start != -1:
            print("Found block:")
            print(content[start:start+200])
PYEOF
