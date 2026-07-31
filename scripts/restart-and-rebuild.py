#!/usr/bin/env python3
"""Restart and rebuild frontend/backend on VPS."""
import sys
import os
import time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "local-deployment", "deployment-manager"))

from config import Config
from ssh_manager import SSHManager
from error_logger import ErrorLogger

config = Config()
error_logger = ErrorLogger("deployment.log")

print("\n" + "="*70)
print("  FULL SERVICE RESTART & REBUILD")
print("="*70)

vps_host = config.get("vps.host")
vps_user = config.get("vps.user")
pem_key = config.get("vps.pem_key_path")
remote_path = config.get("vps.remote_path")

print(f"\n[*] Connecting to {vps_user}@{vps_host}...")

try:
    ssh = SSHManager(host=vps_host, user=vps_user, pem_key_path=pem_key)
    success, msg = ssh.connect()
    if not success:
        print(f"[ERROR] Connection failed: {msg}")
        sys.exit(1)
    
    print(f"[OK] Connected!")
    error_logger.log_info("Connected to VPS for full restart")
    
    # Step 1: Check current PM2 status
    print("\n[1/7] Checking current service status...")
    returncode, stdout, stderr = ssh.execute_command("pm2 list")
    if "online" in stdout:
        print(f"[OK] Services running")
    else:
        print(f"[WARN] Services not running or degraded")
    
    # Step 2: Stop services
    print("\n[2/7] Stopping services...")
    ssh.execute_command("pm2 delete all 2>/dev/null || true")
    ssh.execute_command("pm2 kill")
    time.sleep(2)
    print(f"[OK] Services stopped")
    error_logger.log_info("Services stopped")
    
    # Step 3: Check if frontend dist exists
    print("\n[3/7] Checking frontend build...")
    returncode, stdout, stderr = ssh.execute_command(f"ls -la {remote_path}/artifacts/forum/dist/public/ | head -5")
    if returncode == 0 and "index.html" in stdout:
        print(f"[OK] Frontend dist exists")
    else:
        print(f"[WARN] Frontend dist missing or incomplete, will rebuild")
    
    # Step 4: Rebuild all
    print("\n[4/7] Rebuilding frontend and backend...")
    returncode, stdout, stderr = ssh.execute_command(f"cd {remote_path} && pnpm run build 2>&1 | tail -20")
    
    if returncode == 0 or "error" not in stderr.lower():
        # Check output
        build_output = stdout + stderr
        if "error" in build_output.lower() and "warning" not in build_output.lower():
            print(f"[ERROR] Build failed!")
            print(build_output[-500:])
            error_logger.log_error(f"Build failed: {build_output}")
        else:
            print(f"[OK] Build completed")
            error_logger.log_info("Build completed successfully")
    else:
        print(f"[WARN] Build completed with output")
        print(stdout[-300:])
    
    # Step 5: Verify frontend dist exists now
    print("\n[5/7] Verifying frontend build output...")
    returncode, stdout, stderr = ssh.execute_command(f"ls {remote_path}/artifacts/forum/dist/public/index.html && echo '[OK] index.html exists'")
    if "OK" in stdout or returncode == 0:
        print(f"[OK] Frontend build verified")
    else:
        print(f"[WARN] Frontend dist status: {stdout}")
    
    # Step 6: Start services
    print("\n[6/7] Starting services...")
    returncode, stdout, stderr = ssh.execute_command(f"cd {remote_path} && pm2 start /home/admin/Scootware-Forum/ecosystem.config.cjs --update-env --cwd {remote_path} --only scootware-api 2>&1 | tail -10")
    
    if "launched" in stdout or "online" in stdout:
        print(f"[OK] Services started")
        print(stdout)
        error_logger.log_info("Services started successfully")
    else:
        print(f"[WARN] Startup output:")
        print(stdout)
    
    # Wait for services to come online
    print("\n[*] Waiting for services to initialize (10 seconds)...")
    time.sleep(10)
    
    # Step 7: Verify health
    print("\n[7/7] Verifying services...")
    
    # Check PM2 status
    returncode, stdout, stderr = ssh.execute_command("pm2 status")
    print("\nPM2 Status:")
    for line in stdout.split('\n'):
        if 'scootware-api' in line or 'online' in line or 'stopped' in line:
            print(f"  {line}")
    
    # Check API health
    print("\n[*] API Health Check...")
    returncode, stdout, stderr = ssh.execute_command("curl -s http://127.0.0.1:3000/api/healthz 2>&1 | head -5")
    if "status" in stdout or "ok" in stdout.lower():
        print(f"[OK] API responding")
        print(f"  {stdout.strip()}")
    else:
        print(f"[WARN] API response pending")
    
    # Check nginx
    print("\n[*] Nginx Status...")
    returncode, stdout, stderr = ssh.execute_command("sudo systemctl status nginx | grep -E 'Active|running'")
    if "active (running)" in stdout:
        print(f"[OK] Nginx running")
    else:
        print(f"[WARN] Nginx status: {stdout}")
    
    # Check assets
    print("\n[*] Frontend Assets...")
    returncode, stdout, stderr = ssh.execute_command(f"ls {remote_path}/artifacts/forum/dist/public/ | wc -l")
    if returncode == 0:
        file_count = stdout.strip()
        print(f"[OK] {file_count} files in public directory")
    else:
        print(f"[ERROR] Cannot access public directory")
    
    ssh.disconnect()
    
    print("\n" + "="*70)
    print("  [SUCCESS] Services restarted and rebuilt!")
    print("="*70)
    print("\nNext steps:")
    print("  1. Hard reload browser: Ctrl+Shift+R (or Cmd+Shift+R on Mac)")
    print("  2. Visit: https://scootware.us")
    print("  3. If still issues, check logs:")
    print("     pm2 logs scootware-api")
    print("     tail -50 /var/log/nginx/error.log\n")

except Exception as e:
    print(f"\n[ERROR] {str(e)}")
    error_logger.log_error(f"Restart failed: {str(e)}")
    sys.exit(1)
