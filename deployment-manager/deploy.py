"""Execute full deployment to VPS - Direct upload (no tarball)."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from config import Config
from ssh_manager import SSHManager, DirectUploader
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
    print("[1/4] Connecting to VPS...")
    error_logger.log_info("Connecting to VPS...")
    
    ssh = SSHManager(host=vps_host, user=vps_user, pem_key_path=pem_key)
    success, msg = ssh.connect()
    
    if not success:
        raise Exception(f"SSH connection failed: {msg}")
    
    print(f"      [OK] Connected to {vps_host}")
    error_logger.log_info("SSH connection established")
    
    # Step 2: Direct Upload (no tarball)
    print("\n[2/4] Uploading project files...")
    error_logger.log_info("Uploading project files...")
    
    # Resolve project root relative to this script location (or find ancestor with package.json).
    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir
    while repo_root != repo_root.parent and not (repo_root / "package.json").exists():
        repo_root = repo_root.parent

    if not (repo_root / "package.json").exists():
        repo_root = script_dir.parent

    if not Path(project_root).is_absolute():
        project_root = str((repo_root / project_root).resolve())
    
    print(f"      Source: {project_root}")
    
    def upload_progress(msg):
        print(f"      {msg}")
        error_logger.log_info(msg)
    
    success, msg = DirectUploader.upload_project(
        ssh,
        project_root,
        remote_path,
        exclude_patterns,
        progress_callback=upload_progress
    )
    
    if not success:
        raise Exception(f"Upload failed: {msg}")
    
    print(f"      [OK] Files uploaded successfully")
    error_logger.log_info("Files uploaded successfully")
    
    # Step 3: Run Remote Deployment Script
    print("\n[3/4] Building and restarting services...")
    error_logger.log_info("Running remote deployment script (all)...")
    
    remote_script = f"{remote_path}/live-deployment/remote-manage.sh"
    
    print("      Output from remote server:")
    print("      " + "-"*50)
    
    def deployment_output(line):
        print(f"      {line}")
        error_logger.log_info(line)
    
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
    
    # Step 4: Verify
    print("\n[4/4] Verifying deployment...")
    error_logger.log_info("Verifying deployment...")
    
    returncode, stdout, stderr = ssh.execute_command("pm2 status")
    
    if "scootware-api" in stdout:
        if "online" in stdout or "running" in stdout:
            print(f"      [OK] scootware-api is running")
            error_logger.log_info("Deployment verification: API is running")
        else:
            print(f"      [WARN] scootware-api process found but may not be running")
            error_logger.log_info("API process found but status unclear")
    else:
        print(f"      [WARN] scootware-api not found in PM2")
        error_logger.log_info("API process not found in PM2")
    
    ssh.disconnect()
    
    # Success!
    print("\n" + "="*70)
    print("  [SUCCESS] DEPLOYMENT COMPLETED SUCCESSFULLY!")
    print("="*70)
    print(f"\nDeployment Summary:")
    print(f"  - Deployment Method: Direct File Upload (no tarball)")
    print(f"  - Deployment Time: ~5-10 minutes")
    print(f"  - Services: Restarted via PM2")
    print(f"  - Status: API running on {vps_host}")
    print(f"\nNext Steps:")
    print(f"  1. Verify at: http://scootware.us or http://[VPS_IP]")
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
    print(f"Check deployment.log for troubleshooting details.\n")
    sys.exit(1)
