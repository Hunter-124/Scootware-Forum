#!/bin/bash
echo "=== DB tables ==="
PGPASSWORD=[POSTGRES_PASSWORD] psql -h 127.0.0.1 -U postgres -d scootware -c "\dt"

echo ""
echo "=== DB pool in db/index.ts ==="
cat /home/admin/Scootware-Forum/lib/db/src/index.ts 2>/dev/null | grep -A5 "pool\|Pool" | head -30

echo ""
echo "=== Pool check in app.ts ==="
grep -n "pool\|Pool\|PgSession\|MemorySession" /home/admin/Scootware-Forum/artifacts/api-server/src/app.ts | head -20
