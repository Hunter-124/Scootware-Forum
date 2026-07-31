#!/usr/bin/env python3
"""Quick restart script for VPS services - Fix Error 521."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "local-deployment", "deployment-manager"))

from config import Config
from ssh_manager import SSHManager
from error_logger import ErrorLogger
from datetime import datetime

# Initialize
config = Config()
error_logger = ErrorLogger("deployment.log")

print("\n" + "="*70)
print("  QUICK VPS SERVICE RESTART - Fix Error 521")
print("="*70)

vps_host = config.get("vps.host")
vps_user = config.get("vps.user")
pem_key = config.get("vps.pem_key_path")
remote_path = config.get("vps.remote_path")

print(f"\n[*] Connecting to {vps_user}@{vps_host}...")

try:
    # Connect to VPS
    ssh = SSHManager(host=vps_host, user=vps_user, pem_key_path=pem_key)
    success, msg = ssh.connect()
    
    if not success:
        print(f"[ERROR] Connection failed: {msg}")
        error_logger.log_error(f"Connection failed: {msg}")
        sys.exit(1)
    
    print(f"[OK] Connected!")
    error_logger.log_info("Connected to VPS for restart")
    
    # Step 1: Check current PM2 status
    print("\n[*] Current PM2 status:")
    returncode, stdout, stderr = ssh.execute_command("pm2 status")
    print(stdout)
    error_logger.log_info("Current PM2 status:\n" + stdout)
    
    # Step 2: Kill and restart services
    print("\n[*] Stopping old processes...")
    ssh.execute_command("pm2 delete all 2>/dev/null || true")
    ssh.execute_command("pm2 kill")
    print("[OK] Cleaned up old processes")
    error_logger.log_info("Cleaned up old PM2 processes")
    
    # Step 3: Restart services
    print("\n[*] Starting scootware-api service...")
    remote_script = f"{remote_path}/live-deployment/remote-manage.sh"
    
    returncode, stdout, stderr = ssh.execute_command(f"cd {remote_path} && bash {remote_script} restart")
    
    if returncode == 0:
        print("[OK] Services restarted successfully!")
        print("\nRemote output:")
        print(stdout)
        error_logger.log_info("Services restarted successfully")
    else:
        print("[ERROR] Restart failed!")
        print("STDOUT:", stdout)
        print("STDERR:", stderr)
        error_logger.log_error(f"Restart failed: {stderr}")
        ssh.disconnect()
        sys.exit(1)
    
    # Step 4: Verify health
    print("\n[*] Checking service health...")
    returncode, stdout, stderr = ssh.execute_command("pm2 status")
    print(stdout)
    
    # Check port 3000
    returncode, stdout, stderr = ssh.execute_command("ss -ltnp | grep ':3000' || echo 'Port 3000 check: pending'")
    print("\nPort check:")
    print(stdout)
    
    # Attempt health check
    returncode, stdout, stderr = ssh.execute_command("curl -s http://127.0.0.1:3000/api/healthz || echo 'Health check: pending (service may need 10-15 seconds to start)'")
    print("\nAPI Health:")
    print(stdout)
    
    ssh.disconnect()
    
    print("\n" + "="*70)
    print("  [SUCCESS] Services restarted!")
    print("="*70)
    print("\nNext steps:")
    print("  1. Wait 15-30 seconds for services to fully initialize")
    print("  2. Visit: http://[YOUR_DOMAIN] or http://[VPS_IP]")
    print("  3. Check Cloudflare - error 521 should resolve once origin is responding")
    print("  4. If still not working, check logs: pm2 logs scootware-api\n")
    
    error_logger.log_info("="*70)
    error_logger.log_info("QUICK RESTART COMPLETED")
    error_logger.log_info("="*70)

except Exception as e:
    print(f"\n[ERROR] {str(e)}")
    error_logger.log_error(f"Restart failed: {str(e)}")
    sys.exit(1)
