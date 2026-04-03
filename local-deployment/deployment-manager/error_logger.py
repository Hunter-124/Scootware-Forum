"""Error logging and clipboard management."""
import logging
import os
import pyperclip
import traceback
from datetime import datetime
from pathlib import Path
from typing import Optional


class ErrorLogger:
    """Manages error logging to file and clipboard."""

    def __init__(self, log_file: str = "deployment.log", max_size: int = 10485760):
        """Initialize error logger.
        
        Args:
            log_file: Path to log file
            max_size: Maximum log file size in bytes before rotation
        """
        self.log_file = Path(log_file)
        self.max_size = max_size
        self.logger = self._setup_logger()

    def _setup_logger(self) -> logging.Logger:
        """Setup logging configuration."""
        logger = logging.getLogger("deployment_manager")
        logger.setLevel(logging.DEBUG)
        
        # Create logs directory if needed
        self.log_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Rotate log if too large
        if self.log_file.exists() and self.log_file.stat().st_size > self.max_size:
            backup = self.log_file.with_stem(
                f"{self.log_file.stem}.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            )
            self.log_file.rename(backup)
        
        # File handler
        fh = logging.FileHandler(self.log_file)
        fh.setLevel(logging.DEBUG)
        
        # Console handler
        ch = logging.StreamHandler()
        ch.setLevel(logging.INFO)
        
        # Formatter
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        fh.setFormatter(formatter)
        ch.setFormatter(formatter)
        
        logger.addHandler(fh)
        logger.addHandler(ch)
        
        return logger

    def log_error(self, message: str, exception: Optional[Exception] = None, 
                  copy_to_clipboard: bool = True) -> str:
        """Log an error and optionally copy to clipboard.
        
        Args:
            message: Error message
            exception: Optional exception object
            copy_to_clipboard: Whether to copy full error to clipboard
            
        Returns:
            Full error message logged
        """
        error_msg = message
        
        if exception:
            tb_str = traceback.format_exc()
            error_msg = f"{message}\n\nException: {str(exception)}\n\nTraceback:\n{tb_str}"
            self.logger.error(error_msg)
        else:
            self.logger.error(message)
        
        if copy_to_clipboard:
            try:
                pyperclip.copy(error_msg)
            except Exception as e:
                self.logger.warning(f"Failed to copy to clipboard: {e}")
        
        return error_msg

    def log_info(self, message: str) -> None:
        """Log info message."""
        self.logger.info(message)

    def log_warning(self, message: str) -> None:
        """Log warning message."""
        self.logger.warning(message)

    def log_debug(self, message: str) -> None:
        """Log debug message."""
        self.logger.debug(message)

    def log_success(self, message: str) -> None:
        """Log success message."""
        self.logger.info(f"[OK] {message}")

    def get_recent_logs(self, lines: int = 50) -> str:
        """Get recent log lines.
        
        Args:
            lines: Number of recent lines to retrieve
            
        Returns:
            Recent log lines as string
        """
        if not self.log_file.exists():
            return "No logs available"
        
        try:
            with open(self.log_file, "r") as f:
                all_lines = f.readlines()
            
            # Get last N lines
            recent = all_lines[-lines:] if len(all_lines) > lines else all_lines
            return "".join(recent)
        except Exception as e:
            return f"Error reading logs: {e}"

    def copy_logs_to_clipboard(self, lines: int = 100) -> bool:
        """Copy recent logs to clipboard.
        
        Args:
            lines: Number of recent lines to copy
            
        Returns:
            Success status
        """
        try:
            logs = self.get_recent_logs(lines)
            pyperclip.copy(logs)
            return True
        except Exception as e:
            self.logger.error(f"Failed to copy logs to clipboard: {e}")
            return False
