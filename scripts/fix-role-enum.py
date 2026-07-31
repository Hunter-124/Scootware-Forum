#!/usr/bin/env python3
"""Fix database enum mismatch for user_role on VPS."""
import sys
import os

# Add local-deployment/deployment-manager to path if needed
# The script is usually run from the root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "deployment-manager"))

try:
    from config import Config
    from ssh_manager import SSHManager
    from error_logger import ErrorLogger
except ImportError:
    # Try alternate path if first one fails
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "local-deployment", "deployment-manager"))
    from config import Config
    from ssh_manager import SSHManager
    from error_logger import ErrorLogger

# Initialize
config = Config()
error_logger = ErrorLogger("deployment.log")

print("\n" + "="*70)
print("  DATABASE ENUM FIX - user_role Missing 'mod'")
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
    
    # Check if value already exists to avoid errors
    check_cmd = f"cd {remote_path} && source .env && psql \"$DATABASE_URL\" -tAc \"SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'user_role' AND e.enumlabel = 'mod'\""
    returncode, stdout, stderr = ssh.execute_command(check_cmd)
    
    if stdout.strip() == "1":
        print("[INFO] 'mod' value already exists in 'user_role' enum. No fix needed.")
    else:
        print("\n[*] Adding 'mod' to user_role enum on VPS...")
        
        # We use ALTER TYPE ... ADD VALUE which cannot be run in a transaction block
        # So we run it directly via psql -c
        fix_cmd = f"cd {remote_path} && source .env && psql \"$DATABASE_URL\" -c \"ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'mod';\""
        returncode, stdout, stderr = ssh.execute_command(fix_cmd)
        
        if returncode == 0:
            print(f"[OK] Database enum updated successfully")
            print(f"Output: {stdout}")
        else:
            print(f"[ERROR] Failed to update enum")
            print(f"STDOUT: {stdout}")
            print(f"STDERR: {stderr}")
            sys.exit(1)
    
    ssh.disconnect()
    
    print("\n" + "="*70)
    print("  [SUCCESS] Database ready for deployment!")
    print("="*70 + "\n")

except Exception as e:
    print(f"\n[ERROR] {str(e)}")
    sys.exit(1)
