"""Health monitoring and API status checks."""
import requests
import subprocess
from datetime import datetime
from typing import Dict, Any, Optional, Tuple
from ssh_manager import SSHManager


class HealthMonitor:
    """Monitors backend health and API status."""

    def __init__(self, api_url: str, timeout: int = 5):
        """Initialize health monitor.
        
        Args:
            api_url: Base URL for API health check
            timeout: Request timeout in seconds
        """
        self.api_url = api_url
        self.timeout = timeout

    def check_api_health(self) -> Tuple[bool, Dict[str, Any]]:
        """Check API health status.
        
        Returns:
            (is_healthy, details) tuple where details include status, response_time, etc.
        """
        try:
            start = datetime.now()
            response = requests.get(
                f"{self.api_url}/healthz",
                timeout=self.timeout,
                allow_redirects=False
            )
            response_time = (datetime.now() - start).total_seconds()
            
            details = {
                "status": "healthy" if response.status_code < 400 else "unhealthy",
                "status_code": response.status_code,
                "response_time_ms": round(response_time * 1000, 2),
                "checked_at": datetime.now().isoformat(),
            }
            
            # Try to parse JSON response if available
            try:
                details["body"] = response.json()
            except:
                details["body"] = response.text
            
            return response.status_code < 400, details
        
        except requests.Timeout:
            return False, {
                "status": "timeout",
                "message": f"API did not respond within {self.timeout}s",
                "checked_at": datetime.now().isoformat(),
            }
        except requests.ConnectionError as e:
            return False, {
                "status": "connection_error",
                "message": str(e),
                "checked_at": datetime.now().isoformat(),
            }
        except Exception as e:
            return False, {
                "status": "error",
                "message": str(e),
                "checked_at": datetime.now().isoformat(),
            }

    def check_server_status(self, ssh_manager: SSHManager) -> Tuple[bool, Dict[str, Any]]:
        """Check remote server status via SSH.
        
        Args:
            ssh_manager: Connected SSH manager
            
        Returns:
            (is_healthy, details) tuple
        """
        try:
            # Check PM2 status for scootware-api
            returncode, stdout, stderr = ssh_manager.execute_command("pm2 list")
            
            status_data = {
                "api_running": False,
                "pm2_status": stdout,
                "api_info": None,
            }
            
            # Parse PM2 output to find our app
            if "scootware-api" in stdout:
                if "online" in stdout or "running" in stdout:
                    status_data["api_running"] = True
                    status_data["api_info"] = "API is running"
                else:
                    status_data["api_info"] = "API process exists but not running"
            else:
                status_data["api_info"] = "API process not found in PM2"
            
            # Get system load and memory
            returncode, stdout, stderr = ssh_manager.execute_command("free -h | grep Mem")
            status_data["memory_usage"] = stdout.strip()
            
            returncode, stdout, stderr = ssh_manager.execute_command("uptime")
            status_data["uptime"] = stdout.strip()
            
            # Get recent logs
            returncode, stdout, stderr = ssh_manager.execute_command("pm2 logs scootware-api --lines 20 --nostream")
            status_data["recent_logs"] = stdout or stderr
            
            return status_data.get("api_running", False), status_data
        
        except Exception as e:
            return False, {
                "error": str(e),
                "message": "Failed to check server status"
            }

    def check_database_connection(self, ssh_manager: SSHManager) -> Tuple[bool, str]:
        """Check if PostgreSQL is accessible.
        
        Args:
            ssh_manager: Connected SSH manager
            
        Returns:
            (is_connected, message) tuple
        """
        try:
            # Check PostgreSQL service
            returncode, stdout, stderr = ssh_manager.execute_command(
                "sudo systemctl is-active postgresql || echo 'Service check failed'"
            )
            
            if "active" in stdout:
                return True, "PostgreSQL is running"
            else:
                return False, "PostgreSQL is not running"
        
        except Exception as e:
            return False, f"Database check failed: {e}"

    def get_full_diagnostics(self, ssh_manager: Optional[SSHManager] = None) -> Dict[str, Any]:
        """Get full system diagnostics.
        
        Args:
            ssh_manager: Optional connected SSH manager
            
        Returns:
            Dictionary with all diagnostic information
        """
        diagnostics = {
            "timestamp": datetime.now().isoformat(),
            "api": {},
            "server": {},
            "database": {},
        }
        
        # API health
        is_healthy, details = self.check_api_health()
        diagnostics["api"] = {
            "healthy": is_healthy,
            **details
        }
        
        # Server status
        if ssh_manager:
            is_running, server_status = self.check_server_status(ssh_manager)
            diagnostics["server"] = {
                "running": is_running,
                **server_status
            }
            
            # Database status
            is_connected, db_message = self.check_database_connection(ssh_manager)
            diagnostics["database"] = {
                "connected": is_connected,
                "message": db_message
            }
        
        return diagnostics

    @staticmethod
    def format_diagnostics_for_clipboard(diagnostics: Dict[str, Any]) -> str:
        """Format diagnostics dictionary for clipboard sharing.
        
        Args:
            diagnostics: Diagnostics dictionary from get_full_diagnostics
            
        Returns:
            Formatted string for clipboard
        """
        lines = [
            "=== SCOOTWARE DEPLOYMENT DIAGNOSTICS ===",
            f"Timestamp: {diagnostics.get('timestamp', 'N/A')}",
            "",
            "--- API STATUS ---",
        ]
        
        api = diagnostics.get("api", {})
        lines.append(f"Healthy: {api.get('healthy', False)}")
        lines.append(f"Status Code: {api.get('status_code', 'N/A')}")
        lines.append(f"Response Time: {api.get('response_time_ms', 'N/A')}ms")
        
        if "message" in api:
            lines.append(f"Message: {api['message']}")
        
        lines.append("")
        lines.append("--- SERVER STATUS ---")
        
        server = diagnostics.get("server", {})
        lines.append(f"Running: {server.get('running', False)}")
        lines.append(f"API Info: {server.get('api_info', 'N/A')}")
        
        if "memory_usage" in server:
            lines.append(f"Memory: {server['memory_usage']}")
        
        if "uptime" in server:
            lines.append(f"Uptime: {server['uptime']}")
        
        lines.append("")
        lines.append("--- DATABASE STATUS ---")
        
        db = diagnostics.get("database", {})
        lines.append(f"Connected: {db.get('connected', False)}")
        lines.append(f"Message: {db.get('message', 'N/A')}")
        
        return "\n".join(lines)
