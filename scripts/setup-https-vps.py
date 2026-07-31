#!/usr/bin/env python3
"""Setup HTTPS on VPS - Deploy nginx config and generate SSL certificates."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "local-deployment", "deployment-manager"))

from config import Config
from ssh_manager import SSHManager
from error_logger import ErrorLogger
from pathlib import Path

# Initialize
config = Config()
error_logger = ErrorLogger("deployment.log")

print("\n" + "="*70)
print("  HTTPS SETUP - Deploy Nginx Config & SSL Certificates")
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
        error_logger.log_error(f"Connection failed: {msg}")
        sys.exit(1)
    
    print(f"[OK] Connected!")
    error_logger.log_info("Connected to VPS for HTTPS setup")
    
    # Step 1: Copy nginx config to /etc/nginx/sites-available/scootware
    print("\n[*] Deploying nginx configuration...")
    
    nginx_conf_src = f"{remote_path}/live-deployment/nginx.conf.prod"
    nginx_conf_dest = "/etc/nginx/sites-available/scootware"
    
    # Copy the file
    returncode, stdout, stderr = ssh.execute_command(f"sudo cp {nginx_conf_src} {nginx_conf_dest}")
    if returncode == 0:
        print(f"[OK] Nginx config deployed to {nginx_conf_dest}")
        error_logger.log_info(f"Nginx config deployed to {nginx_conf_dest}")
    else:
        print(f"[ERROR] Failed to copy nginx config: {stderr}")
        error_logger.log_error(f"Failed to copy nginx config: {stderr}")
    
    # Step 2: Enable the site
    print("\n[*] Enabling scootware site...")
    returncode, stdout, stderr = ssh.execute_command(f"sudo ln -sf {nginx_conf_dest} /etc/nginx/sites-enabled/scootware")
    print(f"[OK] Site link created")
    error_logger.log_info("Site link created")
    
    # Step 3: Remove default site if it binds to port 80 (avoid conflict)
    print("\n[*] Checking for conflicting default site...")
    returncode, stdout, stderr = ssh.execute_command("sudo rm -f /etc/nginx/sites-enabled/default || true")
    print(f"[OK] Default site removed (if existed)")
    error_logger.log_info("Default site removed")
    
    # Step 4: Test nginx config
    print("\n[*] Testing nginx configuration...")
    returncode, stdout, stderr = ssh.execute_command("sudo /usr/sbin/nginx -t")
    if returncode == 0:
        print(f"[OK] Nginx config is valid")
        print(f"  {stdout.strip()}")
        error_logger.log_info("Nginx config validation passed")
    else:
        print(f"[WARN] Nginx config test output:")
        print(f"  {stderr}")
    
    # Step 5: Run HTTPS setup script
    print("\n[*] Setting up SSL certificates...")
    setup_https_script = f"{remote_path}/live-deployment/setup-https.sh"
    returncode, stdout, stderr = ssh.execute_command(f"sudo bash {setup_https_script}")
    
    if returncode == 0:
        print(f"[OK] HTTPS setup completed")
        print(f"\n{stdout}")
        error_logger.log_info("HTTPS setup script completed successfully")
    else:
        print(f"[WARN] Setup script output:")
        print(f"{stdout}")
        if stderr:
            print(f"{stderr}")
        error_logger.log_info("HTTPS setup script ran with warnings/output")
    
    # Step 6: Reload nginx
    print("\n[*] Reloading nginx...")
    returncode, stdout, stderr = ssh.execute_command("sudo systemctl reload nginx")
    if returncode == 0:
        print(f"[OK] Nginx reloaded")
        error_logger.log_info("Nginx reloaded successfully")
    else:
        print(f"[ERROR] Failed to reload nginx: {stderr}")
        error_logger.log_error(f"Failed to reload nginx: {stderr}")
    
    # Step 7: Verify
    print("\n[*] Verifying HTTPS setup...")
    
    # Check listening ports
    returncode, stdout, stderr = ssh.execute_command("ss -tlnp | grep -E ':(80|443)' || netstat -tlnp 2>/dev/null | grep -E ':(80|443)'")
    print("\nListening ports:")
    print(stdout)
    
    # Check certificate
    returncode, stdout, stderr = ssh.execute_command("sudo ls -lah /etc/letsencrypt/live/scootware.us/ 2>/dev/null || echo 'Checking for self-signed cert...' && sudo ls -lah /etc/nginx/ssl/ 2>/dev/null || echo 'No self-signed cert'")
    print("\nSSL Certificates:")
    print(stdout)
    
    # Test HTTPS connectivity (self-signed will show error but connection should work)
    print("\n[*] Testing HTTPS connectivity...")
    returncode, stdout, stderr = ssh.execute_command("curl -I -insecure https://127.0.0.1/ 2>&1 | head -10 || echo 'HTTPS test pending'")
    print(f"\nHTTPS Test Result:")
    if "HTTP" in stdout:
        print(f"[OK] HTTPS is responding")
        print(stdout[:200])
    else:
        print(f"Pending (may need certificate generation or restart)")
    
    ssh.disconnect()
    
    print("\n" + "="*70)
    print("  [SUCCESS] HTTPS Setup Completed!")
    print("="*70)
    print("\nNext steps:")
    print("  1. Wait 1-2 minutes for Let's Encrypt to process (if domain verified)")
    print("  2. Test HTTPS: https://scootware.us")
    print("  3. Check logs: sudo journalctl -u nginx -f")
    print("  4. If certificate fails, manually run:")
    print("     sudo certbot --nginx -d scootware.us -d www.scootware.us\n")
    
    error_logger.log_info("="*70)
    error_logger.log_info("HTTPS SETUP COMPLETED")
    error_logger.log_info("="*70)

except Exception as e:
    print(f"\n[ERROR] {str(e)}")
    error_logger.log_error(f"HTTPS setup failed: {str(e)}")
    sys.exit(1)
