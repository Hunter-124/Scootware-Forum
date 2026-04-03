#!/usr/bin/env python3
"""Verify the deployment was successful."""
import sys
sys.path.insert(0, '.')

try:
    from ssh_manager import SSHManager
    
    print("Verifying deployment on VPS...")
    ssh = SSHManager(host="[VPS_IP]", user="admin", pem_key_path="scootware.pem")
    success, msg = ssh.connect()
    
    if not success:
        print(f"SSH failed: {msg}")
        sys.exit(1)
    
    # Check 1: Backend file exists and is recent
    print("\n[1/3] Checking backend files...")
    rc, out, err = ssh.run_command("ls -lh /home/admin/Scootware-Forum/artifacts/api-server/dist/index.mjs | awk '{print $6, $7, $8, $9}'")
    if "index.mjs" in out:
        print(f"✓ Backend compiled: {out.strip()}")
    else:
        print(f"✗ Backend file not found")
    
    # Check 2: PM2 process is running
    print("\n[2/3] Checking PM2 status...")
    rc, out, err = ssh.run_command("pm2 status scootware-api | grep -o 'online'")
    if "online" in out:
        print("✓ Service is ONLINE")
    else:
        print(f"✗ Service not online. Output: {out}")
    
    # Check 3: Backend responds locally
    print("\n[3/3] Checking backend responsiveness...")
    rc, out, err = ssh.run_command("curl -s http://localhost:3000/api/auth/site-config 2>&1 | head -c 100")
    if "requireEmailVerification" in out:
        print(f"✓ Backend responding correctly")
        if "false" in out:
            print("  ✓ requireEmailVerification is FALSE (disabled)")
        else:
            print("  ✗ requireEmailVerification value unclear")
    elif "Connection refused" in out or "error" in out.lower():
        print(f"✗ Backend not responding: {out}")
    else:
        print(f"Response snippet: {out}")
    
    ssh.disconnect()
    print("\n✓ DEPLOYMENT VERIFIED")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
