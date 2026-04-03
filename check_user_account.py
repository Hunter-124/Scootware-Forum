#!/usr/bin/env python3
"""Quick script to check user account status on VPS."""
import subprocess
import json
import sys

def run_ssh_command(command):
    """Execute a command on the VPS via SSH."""
    full_cmd = [
        "ssh",
        "-i", "scootware.pem",
        "admin@[VPS_IP]",
        command
    ]
    
    try:
        result = subprocess.run(full_cmd, capture_output=True, text=True, timeout=10)
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return 1, "", str(e)

def check_server_status():
    """Check if the API server is running."""
    print("==== SERVER STATUS ====")
    code, out, err = run_ssh_command("pm2 status")
    if code == 0:
        print(out)
    else:
        print(f"Error: {err}")
    print()

def check_api_health():
    """Check API health endpoint."""
    print("==== API HEALTH ====")
    code, out, err = run_ssh_command("curl -s http://localhost:3001/api/healthz")
    if code == 0:
        print(out)
    else:
        print(f"Error: {err}")
    print()

def get_user_accounts():
    """Get all user accounts from database."""
    print("==== USER ACCOUNTS ====")
    
    # SQL command to get user info
    sql = """
    SELECT id, username, email, is_email_verified, role, created_at
    FROM users
    ORDER BY created_at DESC
    LIMIT 10;
    """
    
    # Run psql command
    cmd = f"""
    PGPASSWORD=${POSTGRES_PASSWORD} psql -h localhost -U scootadmin -d scootware -c "{sql}"
    """
    
    code, out, err = run_ssh_command(cmd)
    if code == 0:
        print(out)
    else:
        print(f"Error: {err}")
    print()

def get_email_verification_required():
    """Check if email verification is required."""
    print("==== EMAIL VERIFICATION SETTING ====")
    
    sql = """
    SELECT key, value FROM site_config WHERE key = 'requireEmailVerification';
    """
    
    cmd = f"""
    PGPASSWORD=${POSTGRES_PASSWORD} psql -h localhost -U scootadmin -d scootware -c "{sql}"
    """
    
    code, out, err = run_ssh_command(cmd)
    if code == 0:
        print(out if out else "Not set (defaults to true)")
    else:
        print(f"Error: {err}")
    print()

if __name__ == "__main__":
    print("\nSCOOTWARE VPS DIAGNOSTICS\n")
    
    check_server_status()
    check_api_health()
    get_user_accounts()
    get_email_verification_required()
    
    print("\nDiagnostics complete!")
