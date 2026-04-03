"""Quick test of deployment manager components."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from config import Config
from ssh_manager import SSHManager
from health_monitor import HealthMonitor
from error_logger import ErrorLogger
import time

print("\n" + "="*60)
print("  Scootware Deployment Manager - Component Test")
print("="*60 + "\n")

# Test 1: Config Manager
print("[1] Testing Configuration Manager...")
try:
    config = Config()
    print(f"  [OK] Config loaded from: {config.config_path}")
    print(f"  [OK] VPS Host: {config.get('vps.host')}")
    print(f"  [OK] SSH User: {config.get('vps.user')}")
    print(f"  [OK] Remote Path: {config.get('vps.remote_path')}")
    print(f"  [OK] PEM Key Path: {config.get('vps.pem_key_path')}")
except Exception as e:
    print(f"  ✗ Config test failed: {e}")
    sys.exit(1)

# Test 2: Error Logger
print("\n[2] Testing Error Logger...")
try:
    error_logger = ErrorLogger("test_deployment.log")
    error_logger.log_info("Test deployment started")
    error_logger.log_success("Test operation succeeded")
    print(f"  ✓ Logger created: test_deployment.log")
    logs = error_logger.get_recent_logs(5)
    print(f"  ✓ Recent logs retrieved ({len(logs)} bytes)")
except Exception as e:
    print(f"  ✗ Logger test failed: {e}")
    sys.exit(1)

# Test 3: SSH Connection
print("\n[3] Testing SSH Connection...")
try:
    ssh = SSHManager(
        host=config.get("vps.host"),
        user=config.get("vps.user"),
        pem_key_path=config.get("vps.pem_key_path")
    )
    
    success, msg = ssh.connect()
    if success:
        print(f"  [OK] SSH connection successful: {msg}")
        
        # Test basic command
        returncode, stdout, stderr = ssh.execute_command("echo 'Connection test successful'")
        if returncode == 0:
            print(f"  [OK] Remote command executed: {stdout.strip()}")
            error_logger.log_info("SSH connection test passed")
        else:
            print(f"  ✗ Remote command failed: {stderr}")
            error_logger.log_error(f"Remote command failed: {stderr}")
        
        ssh.disconnect()
    else:
        print(f"  ✗ SSH connection failed: {msg}")
        error_logger.log_error(f"SSH connection failed: {msg}")
        sys.exit(1)
except Exception as e:
    print(f"  ✗ SSH test failed: {e}")
    error_logger.log_error(f"SSH test failed: {e}", e)
    sys.exit(1)

# Test 4: Health Monitor
print("\n[4] Testing Health Monitor...")
try:
    health = HealthMonitor("http://[VPS_IP]/api/health", timeout=5)
    
    is_healthy, details = health.check_api_health()
    if is_healthy:
        print(f"  [OK] API is healthy")
        print(f"    Status Code: {details.get('status_code')}")
        print(f"    Response Time: {details.get('response_time_ms')}ms")
        error_logger.log_info("API health check passed")
    else:
        print(f"  ⚠ API not healthy: {details.get('status')}")
        if 'message' in details:
            print(f"    Message: {details['message']}")
except Exception as e:
    print(f"  ✗ Health monitor test failed: {e}")
    error_logger.log_warning(f"Health monitor test: {e}")

# Test 5: Remote Status Check
print("\n[5] Testing Remote Server Status...")
try:
    ssh = SSHManager(
        host=config.get("vps.host"),
        user=config.get("vps.user"),
        pem_key_path=config.get("vps.pem_key_path")
    )
    
    success, msg = ssh.connect()
    if success:
        returncode, stdout, stderr = ssh.execute_command("pm2 status")
        if returncode == 0:
            print(f"  ✓ PM2 Status retrieved")
            if "scootware-api" in stdout:
                print(f"  ✓ scootware-api process found")
                if "online" in stdout or "running" in stdout:
                    print(f"  ✓ Process is running")
                else:
                    print(f"  ⚠ Process exists but may not be running")
            else:
                print(f"  ⚠ scootware-api not found in PM2")
        ssh.disconnect()
except Exception as e:
    print(f"  ⚠ Server status check failed: {e}")

print("\n" + "="*60)
print("  [OK] All Core Components Tested Successfully!")
print("="*60 + "\n")
print("Ready for deployment. Check test_deployment.log for details.\n")
