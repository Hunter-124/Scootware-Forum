#!/bin/bash
# Reset [TEST_USERNAME] password temporarily for testing, then test auth flow
PGPASSWORD=[POSTGRES_PASSWORD] psql -h 127.0.0.1 -U postgres -d scootware << 'SQL'
-- Temporarily update password to 'TestPass123!'
-- bcrypt hash for 'TestPass123!' with salt rounds 12
UPDATE users SET password_hash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TdEpBIhvqO8S.mHNPR9U1B9uFXPy' WHERE username = '[TEST_USERNAME]';
SQL

echo "Password temporarily set to: TestPass123!"
echo ""
echo "=== Testing login + stream flow ==="
BASE="https://scootware.us/api"

echo "--- Login ---"
LOGIN_RESP=$(curl -s -c /tmp/cookies2.txt -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier":"[TEST_USERNAME]","password":"TestPass123!"}')
echo "$LOGIN_RESP"

SESSION_ID=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('sessionId','MISSING'))" 2>/dev/null)
echo "Session ID: $SESSION_ID"
echo ""

echo "--- Stream with cookie (browser-style) ---"
RESULT=$(curl -s -b /tmp/cookies2.txt "$BASE/products/CS2/assets/stream?type=primary_exe" -o /tmp/test_asset.bin -w "Status: %{http_code}, Size: %{size_download}")
echo "$RESULT"
echo ""

echo "--- Stream with Bearer token ---"
RESULT=$(curl -s -H "Authorization: Bearer $SESSION_ID" "$BASE/products/CS2/assets/stream?type=primary_exe" -o /tmp/test_asset2.bin -w "Status: %{http_code}, Size: %{size_download}")
echo "$RESULT"
echo ""

echo "--- Stream with ?sid= query param ---"
RESULT=$(curl -s "$BASE/products/CS2/assets/stream?type=primary_exe&sid=$SESSION_ID" -o /tmp/test_asset3.bin -w "Status: %{http_code}, Size: %{size_download}")
echo "$RESULT"
echo ""

echo "=== Relevant PM2 logs ==="
pm2 logs scootware-api --lines 40 --nostream 2>&1 | grep -E "session|auth|stream|401|200|Loader|require" | tail -30
