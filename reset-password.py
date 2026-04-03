#!/usr/bin/env python3
"""Check user account and reset password."""
import sys
import os
import getpass
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "local-deployment", "deployment-manager"))

from config import Config
from ssh_manager import SSHManager
from error_logger import ErrorLogger

config = Config()
error_logger = ErrorLogger("deployment.log")

print("\n" + "="*70)
print("  USER ACCOUNT & PASSWORD DIAGNOSTICS")
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
    
    # Get username from user
    print("\n[*] Enter your username or email:")
    identifier = input(">>> ").strip()
    
    if not identifier:
        print("[ERROR] Username/email required")
        sys.exit(1)
    
    # Create SQL to query user account
    print(f"\n[*] Checking user account for '{identifier}'...")
    
    # Check user record
    sql_check = f"""
    SELECT 
        id, 
        username, 
        email, 
        is_email_verified,
        password_hash IS NOT NULL as has_password,
        CASE WHEN password_hash IS NULL THEN 'NULL' ELSE 'EXISTS (hidden)' END as password_status
    FROM "users" 
    WHERE username ILIKE '{identifier}' OR email ILIKE '{identifier}'
    LIMIT 1;
    """
    
    cmd = f"cd {remote_path} && psql \"$DATABASE_URL\" << 'EOFQ'\n{sql_check}\nEOFQ"
    returncode, stdout, stderr = ssh.execute_command(f"source .env && {cmd}")
    
    print("\nUser Record:")
    print(stdout)
    
    if "id |" not in stdout:
        print("[ERROR] User not found")
        sys.exit(1)
    
    if "NULL" in stdout:
        print("\n⚠️  PASSWORD HASH IS NULL - This is why login fails!")
        print("\n[*] Would you like to set a new password? (y/n)")
        response = input(">>> ").strip().lower()
        
        if response == 'y':
            new_password = getpass.getpass("Enter new password (or empty for random): ").strip()
            
            if not new_password:
                # Generate random password
                import random
                import string
                new_password = ''.join(random.choices(string.ascii_letters + string.digits + "!@#$%^&*()", k=16))
                print(f"\n✓ Generated random password: {new_password}")
            
            # Create Node.js script to hash password and update
            hash_script = f"""
const bcrypt = require('bcrypt');

(async () => {{
  const password = process.argv[1];
  const hash = await bcrypt.hash(password, 10);
  console.log(hash);
}})();
"""
            
            # Write script and run it
            print("\n[*] Hashing password...")
            returncode, stdout, stderr = ssh.execute_command(f"cd {remote_path} && cat > /tmp/hash_pass.js << 'EOFJS'\n{hash_script}\nEOFJS")
            
            returncode, stdout, stderr = ssh.execute_command(f"cd {remote_path} && node /tmp/hash_pass.js '{new_password}'")
            
            if returncode != 0 or not stdout.strip():
                print(f"[ERROR] Failed to hash password: {stderr}")
                sys.exit(1)
            
            password_hash = stdout.strip()
            print(f"[OK] Password hashed")
            
            # Update the password in database
            print("\n[*] Updating password in database...")
            
            sql_update = f"""
            UPDATE "users" 
            SET password_hash = '{password_hash}' 
            WHERE username ILIKE '{identifier}' OR email ILIKE '{identifier}';
            """
            
            cmd = f"cd {remote_path} && psql \"$DATABASE_URL\" << 'EOFQ'\n{sql_update}\nEOFQ"
            returncode, stdout, stderr = ssh.execute_command(f"source .env && {cmd}")
            
            if "UPDATE" in stdout:
                print(f"[OK] Password updated successfully!")
                print(f"\n✓ You can now login with your new password")
                print(f"\n[*] Password set to: {new_password}")
                print(f"\nNext steps:")
                print(f"  1. Go to: https://scootware.us/login")
                print(f"  2. Enter your username/email: {identifier}")
                print(f"  3. Enter password: {new_password}")
                error_logger.log_info(f"Password reset for user: {identifier}")
            else:
                print(f"[ERROR] Update failed: {stdout}")
                
            # Cleanup temp script
            ssh.execute_command("rm -f /tmp/hash_pass.js")
        else:
            print("[*] Skipped password reset")
    else:
        print("\n✓ Password hash exists in database")
        print("\nPossible issues:")
        print("  1. Password might be incorrect")
        print("  2. There might be a bug in bcrypt comparison")
        print("  3. Try resetting password anyway (y/n)?")
        response = input(">>> ").strip().lower()
        
        if response == 'y':
            print("[*] Running password reset...")
            # Re-run with password reset
            sys.argv = [sys.argv[0]]  # Reset to trigger password reset flow
            # For now, just inform user
            print("\nTo reset password manually, run this script again and choose 'y' when prompted")
    
    ssh.disconnect()
    
    print("\n" + "="*70)
    print("  DIAGNOSTICS COMPLETE")
    print("="*70 + "\n")

except Exception as e:
    print(f"\n[ERROR] {str(e)}")
    import traceback
    traceback.print_exc()
    error_logger.log_error(f"Diagnostics failed: {str(e)}")
    sys.exit(1)
