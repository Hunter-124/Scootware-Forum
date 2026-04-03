"""Fast deployment - rebuild without upload."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from config import Config
from ssh_manager import SSHManager
from error_logger import ErrorLogger

print("\n" + "="*70)
print("  SCOOTWARE - FAST REBUILD DEPLOYMENT")
print("="*70 + "\n")

config = Config()
error_logger = ErrorLogger("deployment.log")

error_logger.log_info("="*70)
error_logger.log_info("FAST REBUILD DEPLOYMENT STARTED (No Upload)")
error_logger.log_info("="*70)

vps_host = config.get("vps.host")
vps_user = config.get("vps.user")
pem_key = config.get("vps.pem_key_path")
remote_path = config.get("vps.remote_path")

print(f"VPS Host:    {vps_host}")
print(f"SSH User:    {vps_user}")
print(f"Remote Path: {remote_path}\n")

try:
    print("[1/3] Connecting to VPS...")
    ssh = SSHManager(host=vps_host, user=vps_user, pem_key_path=pem_key)
    success, msg = ssh.connect()
    
    if not success:
        raise Exception(f"Connection failed: {msg}")
    
    print(f"      [OK] Connected\n")
    error_logger.log_info("SSH connection established")
    
    # Run remote deployment script
    print("[2/3] Rebuilding and restarting services...")
    print("      " + "-"*50)
    
    remote_script = f"{remote_path}/live-deployment/remote-manage.sh"
    
    def show_output(line):
        print(f"      {line}")
        error_logger.log_info(line)
    
    returncode, stdout, stderr = ssh.run_deployment_script(
        remote_script,
        "all",
        progress_callback=show_output
    )
    
    print("      " + "-"*50)
    
    if returncode != 0:
        raise Exception(f"Build failed: {stderr}")
    
    print("\n[3/3] Verifying...")
    
    returncode, stdout, stderr = ssh.execute_command("pm2 status")
    
    if "scootware-api" in stdout and "online" in stdout:
        print("      [OK] API is running\n")
    else:
        print("      [WARN] API status unclear\n")
    
    ssh.disconnect()
    
    # Success
    print("="*70)
    print("  [SUCCESS] DEPLOYMENT COMPLETE!")
    print("="*70)
    print("\nVerify at: http://scootware.us")
    print("Logs: pm2 logs scootware-api\n")
    
    error_logger.log_info("DEPLOYMENT COMPLETED SUCCESSFULLY")
    sys.exit(0)

except Exception as e:
    print(f"\n[ERROR] {e}\n")
    error_logger.log_error(f"Deployment failed: {e}", e, copy_to_clipboard=False)
    sys.exit(1)
