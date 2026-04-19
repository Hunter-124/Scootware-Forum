#!/bin/bash
PGPASSWORD=[POSTGRES_PASSWORD] psql -h 127.0.0.1 -U postgres -d scootware -c "SELECT u.username, le.ip, le.session_id, le.created_at FROM login_events le JOIN users u ON u.id = le.user_id WHERE le.user_agent = 'ScootwareLoader/1.0' ORDER BY le.created_at DESC LIMIT 5"
