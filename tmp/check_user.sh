#!/bin/bash
echo "=== Check [TEST_USERNAME] ==="
PGPASSWORD=[POSTGRES_PASSWORD] psql -h 127.0.0.1 -U postgres -d scootware -c "SELECT id, username, password_hash FROM users WHERE username='[TEST_USERNAME]'"

echo ""
echo "=== Latest login events ==="
PGPASSWORD=[POSTGRES_PASSWORD] psql -h 127.0.0.1 -U postgres -d scootware -c "SELECT u.username, le.ip, le.user_agent, le.created_at FROM login_events le JOIN users u ON u.id = le.user_id ORDER BY le.created_at DESC LIMIT 5"
