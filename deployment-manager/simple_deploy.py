#!/usr/bin/env python3
"""Simple deployment - direct SSH execution."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from config import Config
from ssh_manager import SSHManager

config = Config()
vps_host = config.get("vps.host")
vps_user = config.get("vps.user")
pem_key = config.get("vps.pem_key_path")
remote_path = config.get("vps.remote_path")

print(f"\nConnecting to {vps_user}@{vps_host}...\n")

ssh = SSHManager(host=vps_host, user=vps_user, pem_key_path=pem_key)
success, msg = ssh.connect()

if not success:
    print(f"ERROR: {msg}")
    sys.exit(1)

print("Connected! Running deployment...\n")

# Direct SSH execution without callbacks
import subprocess
cmd = f"""ssh -i "{pem_key}" {vps_user}@{vps_host} 'bash {remote_path}/live-deployment/remote-manage.sh all'"""
os.system(cmd)

print("\nDeployment complete!")
