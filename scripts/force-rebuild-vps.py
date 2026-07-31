#!/usr/bin/env python3
"""Force rebuild on VPS by clearing dist folders and restarting."""

import sys
sys.path.insert(0, str(__import__('pathlib').Path(__file__).parent / "deployment-manager"))

from ssh_manager import SSHManager

# Initialize SSH connection
ssh = SSHManager(
    host="[VPS_IP]",
    user="admin", 
    pem_key_path="scootwareppk.ppk"
)

print("Connecting to VPS...")
connected, msg = ssh.connect()
if not connected:
    print(f"❌ Failed: {msg}")
    sys.exit(1)

print("✓ Connected to VPS")

# Run commands
commands = [
    "cd /home/admin/Scootware-Forum",
    "echo '=== Clearing old build files ==='",
    "rm -rf artifacts/api-server/dist artifacts/next-app/.next",
    "echo '=== Building all services ==='",
    "npm run build 2>&1 | tail -20",
    "echo '=== Restarting services ==='",
    "pm2 restart all --no-save",
    "sleep 2",
    "pm2 status"
]

cmd = " && ".join(commands)
print(f"\n🔄 Running: {cmd[:100]}...\n")

success, output = ssh.execute_command(cmd)
print(output)

if success:
    print("\n✅ Rebuild and restart completed!")
else:
    print(f"\n❌ Error during rebuild: {output}")

ssh.close()
