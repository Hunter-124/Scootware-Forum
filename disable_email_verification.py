#!/usr/bin/env python3
"""Disable email verification requirement."""
import subprocess

def run_ssh_command(command):
    """Execute a command on the VPS via SSH."""
    result = subprocess.run(
        ["ssh", "-i", "[YOUR_SSH_KEY_PATH]", "[SSH_USER]@[VPS_IP]", command],
        capture_output=True,
        text=True,
        timeout=10
    )
    return result.returncode, result.stdout, result.stderr

# SQL to disable email verification requirement
sql = """
INSERT INTO site_config (key, value) VALUES ('requireEmailVerification', 'false')
ON CONFLICT (key) DO UPDATE SET value = 'false';
"""

cmd = f"""
PGPASSWORD=${POSTGRES_PASSWORD} psql -h localhost -U scootadmin -d scootware -c "{sql}"
"""

print("Disabling email verification requirement...")
code, out, err = run_ssh_command(cmd)

if code == 0:
    print("✅ SUCCESS! Email verification disabled.")
    print("\nYou can now login with:")
    print("- Username: [TEST_USERNAME]")
    print("- Email: [TEST_EMAIL]")
    print("\nOR:")
    print("- Username: [TEST_USERNAME]")
    print("- Email: [YOUR_EMAIL]")
    print("- Role: admin")
else:
    print(f"❌ Error: {err}")
