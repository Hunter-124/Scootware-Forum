"""Execute full deployment to VPS."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from config import Config
from ssh_manager import SSHManager, ArchiveUploader
from error_logger import ErrorLogger
from pathlib import Path
import time

print("\n" + "="*70)
print("  SCOOTWARE FORUM - FULL PRODUCTION DEPLOYMENT")
print("="*70 + "\n")

# Initialize components
config = Config()
error_logger = ErrorLogger("deployment.log")

error_logger.log_info("="*70)
error_logger.log_info("FULL PRODUCTION DEPLOYMENT STARTED")
error_logger.log_info("="*70)

# Configuration
vps_host = config.get("vps.host")
vps_user = config.get("vps.user")
pem_key = config.get("vps.pem_key_path")
remote_path = config.get("vps.remote_path")
project_root = config.get("local.project_root", ".")
exclude_patterns = config.get("local.tar_exclude", [])

print(f"VPS Host:       {vps_host}")
print(f"SSH User:       {vps_user}")
print(f"Remote Path:    {remote_path}")
print(f"Project Root:   {project_root}")
print(f"\nExclude Patterns: {', '.join(exclude_patterns)}\n")

error_logger.log_info(f"Deployment Configuration:")
error_logger.log_info(f"  VPS: {vps_user}@{vps_host}")
error_logger.log_info(f"  Remote Path: {remote_path}")
error_logger.log_info(f"  Project Root: {project_root}")

try:
    # Step 1: SSH Connection
    print("[1/5] Connecting to VPS...")
    error_logger.log_info("Connecting to VPS...")
    
    ssh = SSHManager(host=vps_host, user=vps_user, pem_key_path=pem_key)
    success, msg = ssh.connect()
    
    if not success:
        raise Exception(f"SSH connection failed: {msg}")
    
    print(f"      [OK] Connected to {vps_host}")
    error_logger.log_info("SSH connection established")
    
    # Step 2: Create Tarball
    print("\n[2/5] Creating project archive...")
    error_logger.log_info("Creating project archive...")
    
    # Get absolute path
    if not Path(project_root).is_absolute():
        project_root = Path.cwd() / project_root
    
    print(f"      Source: {project_root}")
    
    success, tarball_path = ArchiveUploader.create_tarball(
        str(project_root),
        exclude_patterns
    )
    
    if not success:
        raise Exception(f"Tarball creation failed: {tarball_path}")
    
    tarball_size = Path(tarball_path).stat().st_size / (1024 * 1024)
    print(f"      [OK] Archive created: {tarball_path}")
    print(f"        Size: {tarball_size:.2f} MB")
    error_logger.log_info(f"Archive created: {tarball_path} ({tarball_size:.2f} MB)")
    
    # Step 3: Upload and Extract
    print("\n[3/5] Uploading archive to VPS...")
    error_logger.log_info("Uploading archive to VPS...")
    
    def upload_progress(msg):
        print(f"      {msg}")
        error_logger.log_debug(msg)
    
    success, msg = ArchiveUploader.upload_and_extract(
        ssh,
        tarball_path,
        remote_path,
        progress_callback=upload_progress
    )
    
    if not success:
        raise Exception(f"Upload/extract failed: {msg}")
    
    print(f"      [OK] Archive uploaded and extracted")
    error_logger.log_info("Archive uploaded and extracted successfully")
    
    # Step 4: Run Remote Deployment Script
    print("\n[4/5] Building and restarting services...")
    error_logger.log_info("Running remote deployment script (all)...")
    
    remote_script = f"{remote_path}/live-deployment/remote-manage.sh"
    
    print("      Output from remote server:")
    print("      " + "-"*50)
    
    def deployment_output(line):
        print(f"      {line}")
        error_logger.log_debug(line)
    
    returncode, stdout, stderr = ssh.run_deployment_script(
        remote_script,
        "all",
        progress_callback=deployment_output
    )
    
    print("      " + "-"*50)
    
    if returncode != 0:
        raise Exception(f"Deployment script failed (exit code {returncode}):\n{stderr}")
    
    print(f"      [OK] Remote deployment completed successfully")
    error_logger.log_info("Remote deployment script executed successfully")
    
    # Step 5: Verify
    print("\n[5/5] Verifying deployment...")
    error_logger.log_info("Verifying deployment...")
    
    returncode, stdout, stderr = ssh.execute_command("pm2 status")
    
    if "scootware-api" in stdout:
        if "online" in stdout or "running" in stdout:
            print(f"      [OK] scootware-api is running")
            error_logger.log_info("Deployment verification: API is running")
        else:
            print(f"      ⚠ scootware-api process found but may not be running")
            error_logger.log_warning("API process found but status unclear")
    else:
        print(f"      [WARN] scootware-api not found in PM2")
        error_logger.log_warning("API process not found in PM2")
    
    ssh.disconnect()
    
    # Success!
    print("\n" + "="*70)
    print("  [SUCCESS] DEPLOYMENT COMPLETED SUCCESSFULLY!")
    print("="*70)
    print(f"\nDeployment Summary:")
    print(f"  • Archive Size: {tarball_size:.2f} MB")
    print(f"  • Deployment Time: ~5-10 minutes")
    print(f"  • Services: Restarted via PM2")
    print(f"  • Status: API running on {vps_host}")
    print(f"\nNext Steps:")
    print(f"  1. Verify at: http://[YOUR_DOMAIN] or http://[VPS_IP]")
    print(f"  2. Check logs: pm2 logs scootware-api")
    print(f"  3. Monitor health: Run health check in deployment manager\n")
    
    error_logger.log_info("="*70)
    error_logger.log_info("DEPLOYMENT COMPLETED SUCCESSFULLY")
    error_logger.log_info("="*70)
    
    sys.exit(0)

except Exception as e:
    print(f"\n[ERROR] DEPLOYMENT FAILED: {e}")
    print("\n" + "="*70)
    error_logger.log_error(f"Deployment failed: {e}", e, copy_to_clipboard=False)
    print("="*70)
    print(f"\n[ERROR] Error Details:")
    print(f"  {e}")
    print(f"\nError has been logged to: deployment.log")
    print(f"Error message copied to clipboard for troubleshooting.\n")
    sys.exit(1)
