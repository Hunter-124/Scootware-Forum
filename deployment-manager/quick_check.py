#!/usr/bin/env python3
"""Quick backend diagnostics - run this to check API status immediately."""
import subprocess
import sys

print("\n" + "="*60)
print("SCOOTWARE BACKEND QUICK CHECK")
print("="*60 + "\n")

# Check if SSH key exists
import os
pem_path = "scootware.pem"
if os.path.exists(pem_path):
    print(f"✓ PEM key found: {pem_path}")
else:
    print(f"✗ PEM key NOT found: {pem_path}")
    sys.exit(1)

print("\n--- CHECKING PM2 STATUS ---")
cmd1 = 'ssh -i "scootware.pem" admin@[VPS_IP] "pm2 status"'
subprocess.run(cmd1, shell=True)

print("\n--- CHECKING PM2 LOGS (Last 50 lines) ---")
cmd2 = 'ssh -i "scootware.pem" admin@[VPS_IP] "pm2 logs scootware-api --lines 50"'
subprocess.run(cmd2, shell=True)

print("\n--- CHECKING PORT 3001 ---")
cmd3 = 'ssh -i "scootware.pem" admin@[VPS_IP] "netstat -tulpn | grep 3001"'
print("(If port 3001 is bound, you should see it here)")
subprocess.run(cmd3, shell=True)

print("\n--- TESTING API HEALTH ENDPOINT ---")
cmd4 = 'ssh -i "scootware.pem" admin@[VPS_IP] "curl -i http://localhost:3001/healthz"'
print("(Testing direct localhost connection)")
subprocess.run(cmd4, shell=True)

print("\n--- TESTING VIA NGINX (External) ---")
cmd5 = 'ssh -i "scootware.pem" admin@[VPS_IP] "curl -i http://[VPS_IP]/api/healthz"'
print("(Testing through Nginx proxy)")
subprocess.run(cmd5, shell=True)

print("\n" + "="*60)
print("DIAGNOSTICS COMPLETE")
print("="*60 + "\n")
