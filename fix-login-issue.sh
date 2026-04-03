#!/bin/bash

# Scootware Forum - Login Issue Diagnostic and Fix Script
# This script helps diagnose and fix login problems

set -e

echo "=========================================="
echo "Scootware Forum - Login Issue Fixer"
echo "=========================================="
echo ""

# Function to check health endpoint
check_health() {
    local url=$1
    echo "[*] Checking API health at: $url/healthz"
    if command -v curl &> /dev/null; then
        response=$(curl -s -w "\n%{http_code}" "$url/healthz" 2>&1)
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | sed '$d')
        
        if [ "$http_code" = "200" ]; then
            echo "[✓] API is healthy"
            echo "    Response: $body"
            return 0
        else
            echo "[✗] API returned HTTP $http_code"
            echo "    Response: $body"
            return 1
        fi
    fi
}

# Check if running locally or remotely
if [ "$1" = "local" ] || [ -z "$1" ]; then
    echo "[*] Running local diagnostic..."
    echo ""
    
    # Check if API server is running on port 3000
    if command -v lsof &> /dev/null; then
        if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null && 2>&1; then
            echo "[✓] API server appears to be running on port 3000"
            check_health "http://localhost:3000/api"
        else
            echo "[!] API server doesn't appear to be running on port 3000"
            echo "    You may need to start it with: pnpm start"
        fi
    fi
    
    echo ""
    echo "[*] Checking npm scripts..."
    grep -A 2 '"start"' package.json || echo "No start script found"
    
    echo ""
    echo "[*] Next steps:"
    echo "  1. Ensure API server is running locally:"
    echo "     pnpm start"
    echo "  2. Test login endpoint:"
    echo "     curl -X POST http://localhost:3000/api/auth/login \\"
    echo "       -H 'Content-Type: application/json' \\"
    echo "       -d '{\"identifier\":'your_username\",\"password\":\"your_password\"}'"
    echo ""
    echo "  3. If API returns 404, rebuild:"
    echo "     pnpm run build"
    echo ""
    echo "  4. If API works locally but not remotely:"
    echo "     - Rebuild the project"
    echo "     - Re-deploy to VPS: ./deploy-complete-fix.sh"
    echo ""
    
elif [ "$1" = "remote" ] || [ "$1" = "vps" ]; then
    echo "[*] Running remote VPS diagnostic..."
    echo ""
    
    if [ -z "$VPS_HOST" ]; then
        echo "[!] VPS_HOST not set. Please set VPS credentials:"
        echo "   export VPS_HOST=your_vps_ip"
        echo "   export VPS_USER=your_username"
        exit 1
    fi
    
    echo "[*] Connecting to VPS: $VPS_HOST"
    echo "[*] Checking API status on VPS..."
    
    # This would require SSH setup - for now, just provide instructions
    echo ""
    echo "[*] Remote diagnostic instructions:"
    echo "  SSH into your VPS and run:"
    echo "    cd /home/admin/Scootware-Forum"
    echo "    curl http://localhost:3000/api/healthz"
    echo ""
    echo "  If API returns 404:"
    echo "    1. Check if API process is running:"
    echo "       ps aux | grep 'node\\|npm\\|boot'"
    echo ""
    echo "    2. Check API logs:"
    echo "       tail -100 ~/.pm2/logs/scootware-api-*"
    echo ""
    echo "    3. Restart API server:"
    echo "       pm2 restart scootware-api"
    echo "       or"
    echo "       cd /home/admin/Scootware-Forum && node boot.mjs"
    echo ""
    
else
    echo "Usage: $0 [local|remote|vps]"
    echo ""
    echo "  local   - Run local diagnostics"
    echo "  remote  - Show remote VPS diagnostic steps"
    echo "  vps     - Same as remote"
    exit 1
fi

echo ""
echo "[*] For password reset with the latest bcrypt cost (12):"
echo "  python quick-reset-password.py"
echo ""
