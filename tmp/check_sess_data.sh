#!/bin/bash
PGPASSWORD=[POSTGRES_PASSWORD] psql -h 127.0.0.1 -U postgres -d scootware -c "SELECT sid, sess::json->>'passport' as passport FROM user_sessions LIMIT 5"
