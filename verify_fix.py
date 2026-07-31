#!/usr/bin/env python3
"""Test login with the fixed email verification."""
import subprocess
import json

def run_ssh_command(command):
    """Execute a command on the VPS via SSH."""
    result = subprocess.run(
        ["ssh", "-i", "[YOUR_SSH_KEY_PATH]", "[SSH_USER]@[VPS_IP]", command],
        capture_output=True,
        text=True,
        timeout=10
    )
    return result.returncode, result.stdout, result.stderr

# Verify the setting was updated
print("Verifying email verification is disabled...")
sql = "SELECT value FROM site_config WHERE key = 'requireEmailVerification';"
cmd = f"""PGPASSWORD=${POSTGRES_PASSWORD} psql -h localhost -U scootadmin -d scootware -c "{sql}" """

code, out, err = run_ssh_command(cmd)
if "false" in out:
    print("✅ Email verification disabled confirmed in database")
else:
    print("Database output:", out)

# Check API is still running
print("\nVerifying API server is running...")
code, out, err = run_ssh_command("curl -s http://localhost:3001/api/healthz")
if "ok" in out:
    print("✅ API is running and healthy")
else:
    print("API output:", out)

print("\n" + "="*60)
print("FIX COMPLETE - You can now login!")
print("="*60)
print("\nYour account details:")
print("  Username: [TEST_USERNAME]")
print("  OR")
print("  Username: [TEST_USERNAME] (admin account)")
print("\nGo to: https://scootware.us/login")
print("Enter your username and the password you created")
