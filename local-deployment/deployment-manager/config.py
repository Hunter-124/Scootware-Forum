"""Configuration management for deployment manager."""
import json
import os
from pathlib import Path
from typing import Any, Dict, Optional


class Config:
    """Manages application configuration and credentials."""

    def __init__(self, config_path: Optional[str] = None):
        """Initialize configuration manager.
        
        Args:
            config_path: Path to config file. Defaults to ~/.scootware_deploy.json
        """
        if config_path is None:
            config_path = os.path.expanduser("~/.scootware_deploy.json")
        
        self.config_path = Path(config_path)
        self.data: Dict[str, Any] = {}
        self.load()

    def load(self) -> None:
        """Load configuration from file."""
        if self.config_path.exists():
            try:
                with open(self.config_path, "r") as f:
                    self.data = json.load(f)
            except Exception as e:
                print(f"Error loading config: {e}")
                self.data = self._default_config()
        else:
            self.data = self._default_config()

    def save(self) -> None:
        """Save configuration to file."""
        try:
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.config_path, "w") as f:
                json.dump(self.data, f, indent=2)
        except Exception as e:
            print(f"Error saving config: {e}")

    @staticmethod
    def _default_config() -> Dict[str, Any]:
        """Get default configuration."""
        return {
            "vps": {
                "host": "[VPS_IP]",  # Should come from env var or secure config file
                "user": "admin",
                "port": 22,
                "pem_key_path": "[SSH_KEY_PATH]",  # Should come from env var or secure config file
                "remote_path": "/home/admin/Scootware-Forum",
            },
            "local": {
                "project_root": "../../",  # Go up 2 levels from local-deployment/deployment-manager/ to get to Scootware-Forum source directory
                "tar_exclude": [
                    # ============ CRITICAL EXCLUSIONS ============
                    # Parent-level directory files (not needed for production)
                    # These are development/deployment files at the parent level
                    "CODEBASE_EXPLORATION.md",
                    "SUBSCRIPTION_EXTENSION_FEATURE.md",
                    "SUBSCRIPTION_EXTENSION_QUICK_REFERENCE.md",
                    "application_credentials",
                    "*.lnk",
                    
                    # Version control (not needed on server)
                    ".git",
                    ".github",
                    
                    # Python venv (server uses different environment)
                    ".venv",
                    "venv",
                    "__pycache__",
                    
                    # Build caches and dependencies (not needed, rebuild on server)
                    "node_modules",  # All npm dependencies (rebuilt on server)
                    ".pnpm-store",
                    ".next",  # Next.js build cache
                    
                    # Local deployment/development tools
                    "deployment-manager",  # Local deployment tool
                    "local-deployment",    # Local setup scripts
                    ".agents",             # Local AI agents
                    
                    # Credentials (NEVER deploy!)
                    "*.pem",
                    "*.ppk",
                    "*.key",
                    "[SSH_KEY_PATH]",  # Should come from env var or secure config file
                    "scootwareppk.ppk",
                    
                    # Temporary/cache files and database files (CRITICAL: never override server DB)
                    ".deploy_cache.json",
                    ".pglite-data",
                    "pglite-data",  # This must not overwrite server's database
                    "artifacts/api-server/pglite-data",  # Explicitly exclude server DB storage
                    
                    # Logs
                    "deployment.log",
                    "deployment-live.log",
                    "test_deployment.log",
                    "*.log",
                    
                    # Test/utility files
                    "test_write.txt",
                    "build-output.txt",
                    "*.md",  # Documentation files (not needed on server)
                ],
            },
            "api": {
                "health_check_url": "http://[VPS_IP]/api/healthz",
                "health_check_timeout": 5,
            },
            "logging": {
                "log_file": "deployment.log",
                "max_log_size": 10485760,  # 10MB
            },
        }

    def get(self, path: str, default: Any = None) -> Any:
        """Get configuration value by dot-notation path.
        
        Args:
            path: Dot-separated path (e.g., "vps.host")
            default: Default value if path not found
            
        Returns:
            Configuration value or default
        """
        keys = path.split(".")
        value = self.data
        
        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
            else:
                return default
        
        return value if value is not None else default

    def set(self, path: str, value: Any) -> None:
        """Set configuration value by dot-notation path.
        
        Args:
            path: Dot-separated path (e.g., "vps.host")
            value: Value to set
        """
        keys = path.split(".")
        current = self.data
        
        # Navigate to parent
        for key in keys[:-1]:
            if key not in current:
                current[key] = {}
            current = current[key]
        
        # Set value
        current[keys[-1]] = value

    def to_dict(self) -> Dict[str, Any]:
        """Get all configuration as dictionary."""
        return self.data.copy()
