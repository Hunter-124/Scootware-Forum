#!/usr/bin/env python3
"""Simple password reset tool."""
import sys
import os
import subprocess
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "local-deployment", "deployment-manager"))

from config import Config
from ssh_manager import SSHManager
from error_logger import ErrorLogger

config = Config()
error_logger = ErrorLogger("deployment.log")

print("\n" + "="*70)
print("  SIMPLE PASSWORD RESET")
print("="*70)

vps_host = config.get("vps.host")
vps_user = config.get("vps.user")
pem_key = config.get("vps.pem_key_path")
remote_path = config.get("vps.remote_path")

print(f"\n[*] Enter username or email:")
identifier = input(">>> ").strip()

print(f"[*] Enter new password:")
password = input(">>> ").strip()

if not identifier or not password:
    print("[ERROR] Username and password required")
    sys.exit(1)

try:
    ssh = SSHManager(host=vps_host, user=vps_user, pem_key_path=pem_key)
    success, msg = ssh.connect()
    if not success:
        print(f"[ERROR] Connection failed: {msg}")
        sys.exit(1)
    
    print(f"\n[OK] Connected to VPS")
    
    # Create a Node.js script that will hash the password using bcrypt
    hash_script = """
import bcrypt from 'bcrypt';

const password = process.argv[2];

(async () => {
  try {
    const hash = await bcrypt.hash(password, 12);
    console.log(hash);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
})();
"""
    
    print(f"\n[*] Hashing password with bcrypt...")
    
    # Write script to temp location with .mjs extension for ES modules
    api_path = f"{remote_path}/artifacts/api-server"
    returncode, stdout, stderr = ssh.execute_command(f"cat > {api_path}/hash_temp.mjs << 'EOFJS'\n{hash_script}\nEOFJS")
    
    # Run it with node in the API server directory where node_modules exists
    returncode, stdout, stderr = ssh.execute_command(f"cd {api_path} && node hash_temp.mjs '{password}' 2>&1")
    
    if returncode != 0 or not stdout.strip() or "error" in stdout.lower():
        print(f"[ERROR] Failed to hash password")
        print(f"Output: {stdout}")
        print(f"Error: {stderr}")
        sys.exit(1)
    
    password_hash = stdout.strip()
    print(f"[OK] Password hashed")
    
    # Escape single quotes in identifier for SQL
    identifier_escaped = identifier.replace("'", "''")
    
    # Update database
    print(f"\n[*] Updating password in database...")
    sql = f"""UPDATE "users" SET password_hash = '{password_hash}' WHERE username = '{identifier_escaped}' OR email = '{identifier_escaped}'"""
    
    returncode, stdout, stderr = ssh.execute_command(f"cd {remote_path} && psql \"$DATABASE_URL\" -c \\\"{sql}\\\" 2>&1", )
    
    # Check if psql needs env sourcing
    if "DATABASE_URL" in stderr or returncode != 0:
        returncode, stdout, stderr = ssh.execute_command(f"source .env && cd {remote_path} && psql \"$DATABASE_URL\" -c \"{sql}\"")
    
    if "UPDATE" in stdout or returncode == 0:
        print(f"[OK] Password reset successfully!")
        print(f"\n✅ LOGIN FIXED")
        print(f"\nYou can now login at: https://scootware.us/login")
        print(f"  Username/Email: {identifier}")
        print(f"  Password: {password}\n")
        error_logger.log_info(f"Password reset for {identifier}")
    else:
        print(f"[WARN] Result:")
        print(f"STDOUT: {stdout}")
        print(f"STDERR: {stderr}")
    
    # Cleanup
    api_path = f"{remote_path}/artifacts/api-server"
    ssh.execute_command(f"rm -f {api_path}/hash_temp.mjs")
    ssh.disconnect()

except Exception as e:
    print(f"\n[ERROR] {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
