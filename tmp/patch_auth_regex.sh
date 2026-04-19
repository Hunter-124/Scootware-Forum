#!/bin/bash
AUTH_FILE="/home/admin/Scootware-Forum/artifacts/api-server/src/routes/auth.ts"

python3 << 'PYEOF'
import re

with open('/home/admin/Scootware-Forum/artifacts/api-server/src/routes/auth.ts', 'r') as f:
    content = f.read()

# Pattern for the login event insert
pattern = r'db\.insert\(loginEventsTable\)\.values\(\{.*?userId:\s*user\.id,.*?\}\)\.returning\(\);'
match = re.search(pattern, content, re.DOTALL)

if match:
    old_code = match.group(0)
    # Add sessionId: req.sessionID before the closing brace
    new_code = old_code.replace('})', ', sessionId: req.sessionID })')
    content = content.replace(old_code, new_code)
    with open('/home/admin/Scootware-Forum/artifacts/api-server/src/routes/auth.ts', 'w') as f:
        f.write(content)
    print("SUCCESS: auth.ts patched via regex")
else:
    print("ERROR: Could not match the insert pattern")
PYEOF
