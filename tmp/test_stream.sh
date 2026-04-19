#!/bin/bash
# Test the full login + stream flow using curl, simulating what the loader does
BASE="https://scootware.us/api"

echo "=== Step 1: Login ==="
LOGIN_RESP=$(curl -s -c /tmp/cookies.txt -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier":"[TEST_USERNAME]","password":"password123"}' 2>&1)
echo "$LOGIN_RESP"

SESSION_ID=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('sessionId','NO_SESSION_ID'))" 2>/dev/null)
echo ""
echo "Session ID: $SESSION_ID"

echo ""
echo "=== Step 2: Try stream with cookie (browser-style) ==="
curl -s -b /tmp/cookies.txt "$BASE/products/CS2/assets/stream?type=primary_exe" -o /dev/null -w "Status: %{http_code}\n"

echo ""
echo "=== Step 3: Try stream with Bearer token (loader-style) ==="
curl -s -H "Authorization: Bearer $SESSION_ID" "$BASE/products/CS2/assets/stream?type=primary_exe" -o /dev/null -w "Status: %{http_code}\n"

echo ""
echo "=== Step 4: Try stream with X-Session-ID header ==="
curl -s -H "X-Session-ID: $SESSION_ID" "$BASE/products/CS2/assets/stream?type=primary_exe" -o /dev/null -w "Status: %{http_code}\n"

echo ""
echo "=== Step 5: Try stream with ?sid= query param ==="
curl -s "$BASE/products/CS2/assets/stream?type=primary_exe&sid=$SESSION_ID" -o /dev/null -w "Status: %{http_code}\n"

echo ""
echo "=== PM2 Logs (last 30 lines) ==="
pm2 logs scootware-api --lines 30 --nostream 2>&1 | grep -v "shoutbox\|pino\|at async" | tail -30
