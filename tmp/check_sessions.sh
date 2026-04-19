#!/bin/bash
# Get the actual password hash for [TEST_USERNAME] to help with testing
PGPASSWORD=[POSTGRES_PASSWORD] psql -h 127.0.0.1 -U postgres -d scootware -c "SELECT id, username, email, role FROM users WHERE username='[TEST_USERNAME]';"

echo ""
echo "=== Active sessions in DB for this user ==="
PGPASSWORD=[POSTGRES_PASSWORD] psql -h 127.0.0.1 -U postgres -d scootware -c "SELECT sess::json->>'passport' as passport, expire FROM user_sessions WHERE expire > NOW() ORDER BY expire DESC LIMIT 5;"

echo ""
echo "=== All active sessions ==="
PGPASSWORD=[POSTGRES_PASSWORD] psql -h 127.0.0.1 -U postgres -d scootware -c "SELECT sid, expire FROM user_sessions WHERE expire > NOW() ORDER BY expire DESC LIMIT 10;"
