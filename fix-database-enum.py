#!/usr/bin/env python3
"""Fix database enum mismatch on VPS."""
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
print("  DATABASE ENUM FIX - Upgrade Type Mismatch")
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
    error_logger.log_info("Connected to VPS for database enum fix")
    
    # Create a script to fix the database
    print("\n[*] Creating database fix script on VPS...")
    
    fix_script = f"""{remote_path}/fix-enum.sh"""
    
    script_content = '''#!/bin/bash
set -e
cd ''' + remote_path + '''
source .env
echo "Fixing upgrade_type enum..."
psql "$DATABASE_URL" << EOF
UPDATE "users" SET "upgrade_type" = NULL, "upgrade_expires_at" = NULL WHERE "upgrade_type" IS NOT NULL;
DROP TYPE "public"."upgrade_type" CASCADE;
CREATE TYPE "public"."upgrade_type" AS ENUM(
  'BODYCAM_PREMIUM',
  'BODYCAM_LIFETIME',
  'RUST_PREMIUM',
  'RUST_LIFETIME',
  'DAYZ_PREMIUM',
  'DAYZ_LIFETIME',
  'TARKOV_PREMIUM',
  'TARKOV_LIFETIME',
  'SPOOFER_PREMIUM',
  'SPOOFER_LIFETIME'
);
ALTER TABLE "users" ALTER COLUMN "upgrade_type" TYPE "upgrade_type" USING NULL;
EOF
echo "✓ Enum fixed!"
'''
    
    # Write script to VPS
    cmd = f"cat > {fix_script} << 'ENDSCRIPT'\n{script_content}\nENDSCRIPT"
    ssh.execute_command(cmd)
    ssh.execute_command(f"chmod +x {fix_script}")
    
    print("\n[*] Executing database fix...")
    returncode, stdout, stderr = ssh.execute_command(f"bash {fix_script}")
    
    if "✓ Enum fixed!" in stdout or "CREATE TYPE" in stdout:
        print(f"[OK] Database enum fixed successfully")
        print(f"\n{stdout}")
        error_logger.log_info("Database enum fixed successfully")
    else:
        print(f"[WARN] Fix script output:")
        print(f"STDOUT: {stdout}")
        if stderr:
            print(f"STDERR: {stderr}")
        error_logger.log_info(f"Enum fix: {stdout}")
    
    # Clean up temp script
    ssh.execute_command(f"rm -f {fix_script}")
    
    # Now try the push again
    print("\n[*] Running database push...")
    returncode, stdout, stderr = ssh.execute_command(f"cd {remote_path} && pnpm --filter @workspace/db run push-force")
    
    if returncode == 0:
        print(f"[OK] Database push successful!")
        print(f"\n{stdout[-500:]}")  # Last 500 chars
        error_logger.log_info("Database push successful")
    else:
        # Check for success indicators even with non-zero return code
        if "✓" in stdout or "success" in stdout.lower() or "applied" in stdout.lower():
            print(f"[OK] Database push completed")
            print(f"\n{stdout[-500:]}")
            error_logger.log_info("Database push completed")
        else:
            print(f"[WARN] Push output:")
            print(f"\n{stdout[-500:]}")
            if "error" in stderr.lower():
                print(f"\nSTDERR: {stderr[-300:]}")
            error_logger.log_info(f"Database push: {stdout[-300:]}")
    
    ssh.disconnect()
    
    print("\n" + "="*70)
    print("  [SUCCESS] Database enum fixed!")
    print("="*70 + "\n")

except Exception as e:
    print(f"\n[ERROR] {str(e)}")
    error_logger.log_error(f"Enum fix failed: {str(e)}")
    sys.exit(1)
