#!/bin/bash
PGPASSWORD=[POSTGRES_PASSWORD] psql -h 127.0.0.1 -U postgres -d scootware -c "\dt"
