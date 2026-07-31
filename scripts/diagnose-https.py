#!/usr/bin/env python3
"""Diagnose HTTPS issues on VPS."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "local-deployment", "deployment-manager"))

from config import Config
from ssh_manager import SSHManager
from error_logger import ErrorLogger

# Initialize
config = Config()
error_logger = ErrorLogger("deployment.log")

print("\n" + "="*70)
print("  HTTPS DIAGNOSTICS")
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
    
    # Check nginx status
    print("\n[*] Checking Nginx status...")
    returncode, stdout, stderr = ssh.execute_command("systemctl status nginx")
    print(stdout)
    
    # Check SSL certificates
    print("\n[*] Checking SSL certificates...")
    returncode, stdout, stderr = ssh.execute_command("ls -lah /etc/letsencrypt/live/ 2>/dev/null || echo 'No Let\\'s Encrypt certs found'")
    print(stdout)
    
    # Check nginx config
    print("\n[*] Checking Nginx configuration...")
    returncode, stdout, stderr = ssh.execute_command("cat /etc/nginx/sites-enabled/default 2>/dev/null || cat /etc/nginx/conf.d/default.conf 2>/dev/null || echo 'Config not found in standard locations'")
    print(stdout)
    
    # Check if nginx config syntax is valid
    print("\n[*] Testing Nginx configuration syntax...")
    returncode, stdout, stderr = ssh.execute_command("nginx -t")
    if returncode == 0:
        print("[OK] Nginx config is valid")
        print(stdout)
    else:
        print("[ERROR] Nginx config has errors:")
        print(stderr)
    
    # Check nginx error log
    print("\n[*] Recent Nginx errors...")
    returncode, stdout, stderr = ssh.execute_command("tail -50 /var/log/nginx/error.log 2>/dev/null | head -20")
    if stdout.strip():
        print(stdout)
    else:
        print("No recent errors")
    
    # Test HTTP vs HTTPS
    print("\n[*] Testing connectivity...")
    
    print("\n  HTTP Test:")
    returncode, stdout, stderr = ssh.execute_command("curl -s -I http://127.0.0.1:3000/ | head -5")
    print(f"  {stdout}")
    
    print("\n  HTTPS Test (port 443):")
    returncode, stdout, stderr = ssh.execute_command("curl -s -I https://127.0.0.1/ 2>&1 | head -5")
    print(f"  {stdout}")
    
    # Check if ports are listening
    print("\n[*] Checking listening ports...")
    returncode, stdout, stderr = ssh.execute_command("ss -tlnp 2>/dev/null | grep -E ':(80|443|3000)' || netstat -tlnp 2>/dev/null | grep -E ':(80|443|3000)'")
    print(stdout)
    
    # Check the nginx prod config location
    print("\n[*] Checking for prod nginx config...")
    returncode, stdout, stderr = ssh.execute_command("ls -lah " + remote_path + "/live-deployment/nginx.conf.prod")
    print(stdout)
    
    ssh.disconnect()
    
    print("\n" + "="*70)
    print("  DIAGNOSTICS COMPLETE")
    print("="*70 + "\n")

except Exception as e:
    print(f"\n[ERROR] {str(e)}")
    error_logger.log_error(f"Diagnostics failed: {str(e)}")
    sys.exit(1)
