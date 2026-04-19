#!/bin/bash
echo "=== Creating user_sessions table ==="
PGPASSWORD=[POSTGRES_PASSWORD] psql -h 127.0.0.1 -U postgres -d scootware << 'SQL'
CREATE TABLE IF NOT EXISTS user_sessions (
  sid VARCHAR NOT NULL COLLATE "default",
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL,
  PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE
) WITH (OIDS=FALSE);

CREATE INDEX IF NOT EXISTS IDX_session_expire ON user_sessions (expire);
SQL

echo ""
echo "=== Verifying table created ==="
PGPASSWORD=[POSTGRES_PASSWORD] psql -h 127.0.0.1 -U postgres -d scootware -c "\dt user_sessions"

echo ""
echo "=== Restarting API ==="
pm2 restart scootware-api
sleep 3

echo ""
echo "=== Startup logs ==="
pm2 logs scootware-api --lines 20 --nostream 2>&1 | grep -v "shoutbox" | tail -15
