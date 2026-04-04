#!/bin/bash
# Migrate loader_versions table to database

set -e

cd /home/admin/Scootware-Forum/Scootware-Forum/lib/db

echo "==================================="
echo "Generating loader_versions migration..."
echo "==================================="

npx drizzle-kit generate --dialect=postgresql --schema=src/schema/index.ts --out=drizzle

echo ""
echo "==================================="
echo "Running migration..."
echo "==================================="

npx drizzle-kit migrate --dialect=postgresql

echo ""
echo "==================================="
echo "✓ Migration completed successfully!"
echo "==================================="
