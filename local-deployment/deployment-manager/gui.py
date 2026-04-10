"""Main GUI application for Scootware deployment management."""
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext, filedialog, simpledialog
import threading
import os
import sys
from pathlib import Path
from typing import Optional, Callable
import pyperclip

from config import Config
from error_logger import ErrorLogger
from ssh_manager import SSHManager, DirectUploader
from health_monitor import HealthMonitor




class DeploymentGUI:
    def _clear_hashcache_and_full_upload(self) -> None:
        """Clear the hashcache and upload all files (start hashcache fresh)."""
        if not self.connected:
            messagebox.showerror("Not Connected", "Please connect to VPS first")
            return

        if not messagebox.askyesno("Confirm", "Clear hashcache and upload ALL files to VPS?\n\nThis will force a full upload and reset the upload cache."):
            return

        self.deployment_in_progress = True
        self._update_status("Clearing hashcache and uploading all files...", 0)

        def action():
            try:
                if not self.ssh_manager:
                    raise Exception("SSH manager not initialized")

                # Resolve project root
                source_path = self._get_project_root()
                cache_file = source_path / ".deploy_cache.json"
                # Remove hashcache file if it exists
                if cache_file.exists():
                    cache_file.unlink()
                    self._append_deploy_output("[INFO] Cleared .deploy_cache.json (hashcache)\n")
                else:
                    self._append_deploy_output("[INFO] No hashcache file found, starting fresh\n")

                exclude_patterns = self.config.get("local.tar_exclude", [])

                success, msg = DirectUploader.upload_project(
                    self.ssh_manager,
                    str(source_path),
                    self.remote_path_var.get(),
                    exclude_patterns,
                    progress_callback=self._append_deploy_output
                )

                if not success:
                    raise Exception(msg)

                self._append_deploy_output("\n[OK] Full upload completed and hashcache reset.\n")
                self.error_logger.log_success("Full upload after clearing hashcache")
                self.root.after(0, lambda: messagebox.showinfo("Upload Complete", "Full upload completed and hashcache reset."))
            except Exception as e:
                error_msg = f"Full upload failed: {e}"
                self._append_deploy_output(f"\n[ERROR] {error_msg}\n")
                self.error_logger.log_error(error_msg, e)
                self.root.after(0, lambda: messagebox.showerror("Upload Failed", error_msg))
            finally:
                self.deployment_in_progress = False
                self._update_status("Ready")

        thread = threading.Thread(target=action, daemon=True)
        thread.start()

    def _get_project_root(self):
        """Return the local project root directory as a Path object.
        
        This must resolve to the INNER Scootware-Forum directory containing lib/, artifacts/, etc.
        NOT the parent directory level.
        """
        # Use the value from the project root entry field, fallback to config if needed
        root_path = self.project_root_var.get() if hasattr(self, 'project_root_var') else self.config.get("local.project_root")
        if not root_path:
            raise Exception("Project root is not set. Please specify the local project root in the UI.")
        
        root_path = Path(root_path)
        
        # If the path is relative, resolve it relative to the script's directory, not cwd
        if not root_path.is_absolute():
            script_dir = Path(__file__).resolve().parent
            root_path = (script_dir / root_path).resolve()
        else:
            root_path = root_path.resolve()
        
        # Validate: project root MUST contain lib/ and/or artifacts/ directories
        lib_dir = root_path / "lib"
        artifacts_dir = root_path / "artifacts"
        if not (lib_dir.exists() or artifacts_dir.exists()):
            raise Exception(
                f"Invalid project root: {root_path}\n\n"
                f"Expected to find 'lib/' or 'artifacts/' directory.\n"
                f"This should be the INNER Scootware-Forum directory, not the parent level.\n\n"
                f"Currently points to: {root_path}\n"
                f"- Contains lib/: {lib_dir.exists()}\n"
                f"- Contains artifacts/: {artifacts_dir.exists()}\n\n"
                f"Please use the 'Browse' button to select the correct directory."
            )
        
        return root_path

    def __init__(self, root):
        self.root = root
        self.config = Config()
        self.error_logger = ErrorLogger(self.config.get("logging.log_file"))
        self.connected = False
        self.ssh_manager = None
        self.deployment_in_progress = False
        self._setup_ui()

    def _setup_ui(self):
        # Main notebook (tabs)
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # Create tabs
        self._create_connection_tab()
        self._create_deployment_tab()
        self._create_health_tab()
        self._create_logs_tab()
        self._create_settings_tab()

        # Status bar
        self._create_status_bar()

    def _check_local_build(self) -> tuple[bool, str]:
        """Check if the project builds successfully locally.
        
        Returns:
            Tuple of (success: bool, message: str)
        """
        try:
            project_root = self._get_project_root()
            self._append_deploy_output("[INFO] Checking local build...\n")
            self._append_deploy_output("[INFO] Running: pnpm run build\n")
            
            import subprocess
            import shutil
            
            # Find pnpm executable
            pnpm_path = shutil.which("pnpm")
            if not pnpm_path:
                # Try common locations
                import os
                possible_paths = [
                    os.path.expandvars("%APPDATA%\\npm\\pnpm.cmd"),
                    "pnpm.cmd",
                    "pnpm"
                ]
                for path in possible_paths:
                    if os.path.exists(path):
                        pnpm_path = path
                        break
            
            if not pnpm_path:
                pnpm_path = "pnpm"
            
            result = subprocess.run(
                [pnpm_path, "run", "build"],
                cwd=str(project_root),
                capture_output=True,
                text=True,
                timeout=300,  # 5 minute timeout
                shell=False
            )
            
            if result.returncode == 0:
                self._append_deploy_output("[✓] Local build succeeded\n")
                return True, "Build successful"
            else:
                error_msg = result.stderr or result.stdout
                self._append_deploy_output(f"[✗] Local build FAILED:\n{error_msg}\n")
                # Extract first few lines of error for user message
                error_lines = error_msg.split('\n')[:5]
                return False, f"Build failed:\n" + "\n".join(error_lines)
                
        except subprocess.TimeoutExpired:
            self._append_deploy_output("[✗] Local build timed out (5 minutes)\n")
            return False, "Build timed out"
        except Exception as e:
            self._append_deploy_output(f"[✗] Error checking build: {e}\n")
            return False, f"Error checking build: {e}"

    def _deploy_upload_new_files(self) -> None:
        """Upload only new/changed code files to VPS."""
        if not self.connected:
            messagebox.showerror("Not Connected", "Please connect to VPS first")
            return

        # Check local build first
        build_ok, build_msg = self._check_local_build()
        if not build_ok:
            if not messagebox.askyesno(
                "Build Check Failed",
                f"{build_msg}\n\nContinue with upload anyway?\n"
                "(Server build will fail after upload)"
            ):
                self._append_deploy_output("[INFO] Upload cancelled by user\n")
                return

        if not messagebox.askyesno("Confirm", "Upload new code files to VPS?"):
            return

        self.deployment_in_progress = True
        self._update_status("Uploading new code files...", 0)

        def action():
            try:
                if not self.ssh_manager:
                    raise Exception("SSH manager not initialized")

                # Resolve project root
                source_path = self._get_project_root()

                self._append_deploy_output(f"[INFO] Uploading new code files from {source_path}...\n")
                exclude_patterns = self.config.get("local.tar_exclude", [])

                success, msg = DirectUploader.upload_project(
                    self.ssh_manager,
                    str(source_path),
                    self.remote_path_var.get(),
                    exclude_patterns,
                    progress_callback=self._append_deploy_output
                )

                if not success:
                    raise Exception(msg)

                self._append_deploy_output("\n[OK] Code files uploaded successfully.\n")
                self.error_logger.log_success("New code files uploaded")
                self.root.after(0, lambda: messagebox.showinfo("Upload Complete", "Code upload completed successfully"))
            except Exception as e:
                error_msg = f"Upload failed: {e}"
                self._append_deploy_output(f"\n[ERROR] {error_msg}\n")
                self.error_logger.log_error(error_msg, e)
                self.root.after(0, lambda: messagebox.showerror("Upload Failed", error_msg))
            finally:
                self.deployment_in_progress = False
                self._update_status("Ready")

        thread = threading.Thread(target=action, daemon=True)
        thread.start()

    def _create_connection_tab(self) -> None:
        """Create connection configuration tab."""
        frame = ttk.Frame(self.notebook)
        self.notebook.add(frame, text="🔌 Connection")
        
        # Title
        title = ttk.Label(frame, text="VPS Connection Settings", font=("Arial", 14, "bold"))
        title.pack(padx=10, pady=10)
        
        # Settings frame
        settings_frame = ttk.LabelFrame(frame, text="Configuration")
        settings_frame.pack(padx=10, pady=5, fill=tk.X)
        
        # VPS Host
        ttk.Label(settings_frame, text="VPS Host:").grid(row=0, column=0, sticky=tk.W, padx=5, pady=5)
        self.host_var = tk.StringVar(value=self.config.get("vps.host"))
        ttk.Entry(settings_frame, textvariable=self.host_var, width=40).grid(row=0, column=1, padx=5, pady=5)
        
        # SSH User
        ttk.Label(settings_frame, text="SSH User:").grid(row=1, column=0, sticky=tk.W, padx=5, pady=5)
        self.user_var = tk.StringVar(value=self.config.get("vps.user"))
        ttk.Entry(settings_frame, textvariable=self.user_var, width=40).grid(row=1, column=1, padx=5, pady=5)
        
        # PEM Key
        ttk.Label(settings_frame, text="PEM Key:").grid(row=2, column=0, sticky=tk.W, padx=5, pady=5)
        key_frame = ttk.Frame(settings_frame)
        key_frame.grid(row=2, column=1, padx=5, pady=5, sticky=tk.W)
        
        self.key_var = tk.StringVar(value=self.config.get("vps.pem_key_path"))
        ttk.Entry(key_frame, textvariable=self.key_var, width=30).pack(side=tk.LEFT)
        ttk.Button(key_frame, text="Browse", command=self._browse_key_file).pack(side=tk.LEFT, padx=5)
        
        # Remote Path
        ttk.Label(settings_frame, text="Remote Path:").grid(row=3, column=0, sticky=tk.W, padx=5, pady=5)
        self.remote_path_var = tk.StringVar(value=self.config.get("vps.remote_path"))
        ttk.Entry(settings_frame, textvariable=self.remote_path_var, width=40).grid(row=3, column=1, padx=5, pady=5)
        
        # Connection test frame
        test_frame = ttk.LabelFrame(frame, text="Connection Test")
        test_frame.pack(padx=10, pady=5, fill=tk.X)
        
        self.connect_button = ttk.Button(test_frame, text="Connect", command=self._test_connection)
        self.connect_button.pack(padx=5, pady=10)

        self.connection_status_var = tk.StringVar(value="Not connected")
        status_label = ttk.Label(test_frame, textvariable=self.connection_status_var, foreground="red")
        status_label.pack(padx=5, pady=5)
        
        # Save settings buttons
        button_frame = ttk.Frame(frame)
        button_frame.pack(padx=10, pady=10, fill=tk.X)
        
        ttk.Button(button_frame, text="Save Configuration", command=self._save_config).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="Reset to Defaults", command=self._reset_config).pack(side=tk.LEFT, padx=5)

    def _create_deployment_tab(self) -> None:
        """Create deployment operations tab (streamlined)."""
        frame = ttk.Frame(self.notebook)
        self.notebook.add(frame, text="🚀 Deploy")
        # Title
        title = ttk.Label(frame, text="Deployment Operations", font=("Arial", 14, "bold"))
        title.pack(padx=10, pady=10)
        # Local project settings
        settings_frame = ttk.LabelFrame(frame, text="Local Project")
        settings_frame.pack(padx=10, pady=5, fill=tk.X)
        ttk.Label(settings_frame, text="Project Root:").grid(row=0, column=0, sticky=tk.W, padx=5, pady=5)
        self.project_root_var = tk.StringVar(value=self.config.get("local.project_root"))
        project_frame = ttk.Frame(settings_frame)
        project_frame.grid(row=0, column=1, padx=5, pady=5, sticky=tk.W)
        ttk.Entry(project_frame, textvariable=self.project_root_var, width=30).pack(side=tk.LEFT)
        ttk.Button(project_frame, text="Browse", command=self._browse_project_root).pack(side=tk.LEFT, padx=5)
        # Deployment options
        deploy_frame = ttk.LabelFrame(frame, text="Deployment Options")
        deploy_frame.pack(padx=10, pady=5, fill=tk.BOTH, expand=True)

        # BIG RED DEPLOY ALL BUTTON
        deploy_all_frame = ttk.Frame(deploy_frame)
        deploy_all_frame.pack(anchor=tk.CENTER, padx=10, pady=(15, 20), fill=tk.X)
        deploy_all_btn = tk.Button(deploy_all_frame, text="🚀 DEPLOY ALL", command=self._deploy_full, 
                                    bg="#DC143C", fg="white", font=("Arial", 16, "bold"), 
                                    padx=30, pady=15, relief=tk.RAISED, bd=3, activebackground="#FF1744")
        deploy_all_btn.pack(expand=True)
        
        deploy_all_info = ttk.Label(deploy_frame, text="Complete deployment: Upload → Build → Migrate DB → Restart → Health Check", 
                                   font=("Arial", 10, "italic"), foreground="gray")
        deploy_all_info.pack(anchor=tk.CENTER, pady=(0, 10))

        # Upload controls
        ttk.Label(deploy_frame, text="📦 Upload Files", font=("Arial", 12, "bold")).pack(anchor=tk.W, padx=10, pady=(10, 5))
        ttk.Label(deploy_frame, text="Choose how to upload your code to the VPS.").pack(anchor=tk.W, padx=20, pady=5)
        upload_frame = ttk.Frame(deploy_frame)
        upload_frame.pack(anchor=tk.W, padx=20, pady=5)
        ttk.Button(upload_frame, text="Upload Changed Files Only", command=self._deploy_upload_new_files).pack(side=tk.LEFT, padx=5)
        ttk.Button(upload_frame, text="Full Upload (Reset Cache)", command=self._clear_hashcache_and_full_upload).pack(side=tk.LEFT, padx=5)

        # Build & Deploy workflow
        ttk.Label(deploy_frame, text="🏗️ Build & Deploy", font=("Arial", 12, "bold")).pack(anchor=tk.W, padx=10, pady=(15, 5))
        ttk.Label(deploy_frame, text="Build your application and deploy with one click.").pack(anchor=tk.W, padx=20, pady=5)
        build_frame = ttk.Frame(deploy_frame)
        build_frame.pack(anchor=tk.W, padx=20, pady=5)
        ttk.Button(build_frame, text="Build & Deploy", command=lambda: self._run_remote_command("build", "Building and deploying project...")).pack(side=tk.LEFT, padx=5)
        
        # Service control
        ttk.Label(deploy_frame, text="⚡ Service Controls", font=("Arial", 12, "bold")).pack(anchor=tk.W, padx=10, pady=(15, 5))
        service_frame = ttk.Frame(deploy_frame)
        service_frame.pack(anchor=tk.W, padx=20, pady=5, fill=tk.X)
        ttk.Button(service_frame, text="Start", command=self._start_services).pack(side=tk.LEFT, padx=5)
        ttk.Button(service_frame, text="Stop", command=self._stop_services).pack(side=tk.LEFT, padx=5)
        ttk.Button(service_frame, text="Restart", command=lambda: self._run_remote_command("restart", "Restarting services...")).pack(side=tk.LEFT, padx=5)
        ttk.Button(service_frame, text="Reboot VPS", command=lambda: self._run_remote_command("reboot", "Rebooting server VPS...")).pack(side=tk.LEFT, padx=5)
        # Output
        ttk.Label(deploy_frame, text="Output:", font=("Arial", 10, "bold")).pack(anchor=tk.W, padx=10, pady=(15, 5))
        self.deploy_output = scrolledtext.ScrolledText(deploy_frame, height=15, width=80)
        self.deploy_output.pack(padx=10, pady=5, fill=tk.BOTH, expand=True)
        # Control buttons
        control_frame = ttk.Frame(deploy_frame)
        control_frame.pack(padx=10, pady=10, fill=tk.X)
        ttk.Button(control_frame, text="Clear Output", command=lambda: self.deploy_output.delete("1.0", tk.END)).pack(side=tk.LEFT, padx=5)
        ttk.Button(control_frame, text="Copy Output", command=self._copy_deploy_output).pack(side=tk.LEFT, padx=5)

    def _create_health_tab(self) -> None:
        """Create health monitoring tab."""
        frame = ttk.Frame(self.notebook)
        self.notebook.add(frame, text="❤️ Health")
        
        # Title
        title = ttk.Label(frame, text="Server Health Monitoring", font=("Arial", 14, "bold"))
        title.pack(padx=10, pady=10)
        
        # API Health
        api_frame = ttk.LabelFrame(frame, text="API Health Check")
        api_frame.pack(padx=10, pady=5, fill=tk.X)
        
        ttk.Label(api_frame, text="API URL:").grid(row=0, column=0, sticky=tk.W, padx=5, pady=5)
        self.api_url_var = tk.StringVar(value=self.config.get("api.health_check_url"))
        ttk.Entry(api_frame, textvariable=self.api_url_var, width=50).grid(row=0, column=1, padx=5, pady=5)
        
        ttk.Button(api_frame, text="Check API Status", command=self._check_api_health).grid(row=1, column=0, columnspan=2, padx=5, pady=5)
        
        self.api_status_var = tk.StringVar(value="Status: Not checked")
        ttk.Label(api_frame, textvariable=self.api_status_var).grid(row=2, column=0, columnspan=2, padx=5, pady=5)
        
        # Server monitoring
        server_frame = ttk.LabelFrame(frame, text="Server Status")
        server_frame.pack(padx=10, pady=5, fill=tk.BOTH, expand=True)
        
        ttk.Button(server_frame, text="Full Diagnostics", command=self._check_full_diagnostics).pack(anchor=tk.W, padx=10, pady=10)
        
        self.health_output = scrolledtext.ScrolledText(server_frame, height=20, width=80)
        self.health_output.pack(padx=10, pady=5, fill=tk.BOTH, expand=True)
        
        # Control buttons
        control_frame = ttk.Frame(server_frame)
        control_frame.pack(padx=10, pady=10, fill=tk.X)
        
        ttk.Button(control_frame, text="Clear Output", command=lambda: self.health_output.delete("1.0", tk.END)).pack(side=tk.LEFT, padx=5)
        ttk.Button(control_frame, text="Copy to Clipboard", command=self._copy_health_output).pack(side=tk.LEFT, padx=5)
        ttk.Button(control_frame, text="Copy Diagnostics for Support", command=self._copy_diagnostics_formatted).pack(side=tk.LEFT, padx=5)

    def _create_logs_tab(self) -> None:
        """Create application logs tab."""
        frame = ttk.Frame(self.notebook)
        self.notebook.add(frame, text="📝 Logs")
        
        # Title
        title = ttk.Label(frame, text="Deployment Manager Logs", font=("Arial", 14, "bold"))
        title.pack(padx=10, pady=10)
        
        # Log display
        self.logs_output = scrolledtext.ScrolledText(frame, height=25, width=80)
        self.logs_output.pack(padx=10, pady=5, fill=tk.BOTH, expand=True)
        
        # Control buttons
        control_frame = ttk.Frame(frame)
        control_frame.pack(padx=10, pady=10, fill=tk.X)
        
        ttk.Button(control_frame, text="Refresh Logs", command=self._refresh_logs).pack(side=tk.LEFT, padx=5)
        ttk.Button(control_frame, text="Clear Logs", command=self._clear_logs).pack(side=tk.LEFT, padx=5)
        ttk.Button(control_frame, text="Copy Logs", command=self._copy_logs).pack(side=tk.LEFT, padx=5)
        ttk.Button(control_frame, text="Open Log File", command=self._open_log_file).pack(side=tk.LEFT, padx=5)
        
        # Auto-refresh logs on tab switch
        self._refresh_logs()

    def _create_settings_tab(self) -> None:
        """Create settings tab."""
        frame = ttk.Frame(self.notebook)
        self.notebook.add(frame, text="⚙️ Settings")
        
        # Title
        title = ttk.Label(frame, text="Application Settings", font=("Arial", 14, "bold"))
        title.pack(padx=10, pady=10)
        
        # API Settings
        api_frame = ttk.LabelFrame(frame, text="API Health Check")
        api_frame.pack(padx=10, pady=5, fill=tk.X)
        
        ttk.Label(api_frame, text="Health Check URL:").grid(row=0, column=0, sticky=tk.W, padx=5, pady=5)
        self.settings_api_url = tk.StringVar(value=self.config.get("api.health_check_url"))
        ttk.Entry(api_frame, textvariable=self.settings_api_url, width=50).grid(row=0, column=1, padx=5, pady=5)
        
        ttk.Label(api_frame, text="Timeout (seconds):").grid(row=1, column=0, sticky=tk.W, padx=5, pady=5)
        self.settings_timeout = tk.IntVar(value=self.config.get("api.health_check_timeout"))
        ttk.Spinbox(api_frame, from_=1, to=30, textvariable=self.settings_timeout, width=10).grid(row=1, column=1, sticky=tk.W, padx=5, pady=5)
        
        # Logging Settings
        log_frame = ttk.LabelFrame(frame, text="Logging")
        log_frame.pack(padx=10, pady=5, fill=tk.X)
        
        ttk.Label(log_frame, text="Log File:").grid(row=0, column=0, sticky=tk.W, padx=5, pady=5)
        self.settings_log_file = tk.StringVar(value=self.config.get("logging.log_file"))
        ttk.Entry(log_frame, textvariable=self.settings_log_file, width=50).grid(row=0, column=1, padx=5, pady=5)
        
        # Save button
        ttk.Button(frame, text="Save Settings", command=self._save_settings).pack(anchor=tk.W, padx=10, pady=10)

    def _create_status_bar(self) -> None:
        """Create status bar."""
        status_frame = ttk.Frame(self.root)
        status_frame.pack(fill=tk.X, side=tk.BOTTOM)
        
        self.status_var = tk.StringVar(value="Ready")
        status_label = ttk.Label(status_frame, textvariable=self.status_var, relief=tk.SUNKEN)
        status_label.pack(fill=tk.X, padx=5, pady=5)

    def _update_status(self, message: str, duration: int = 0) -> None:
        """Update status bar message.
        
        Args:
            message: Status message
            duration: Duration in milliseconds (0 = permanent)
        """
        self.status_var.set(message)
        self.root.update()
        
        if duration > 0:
            self.root.after(duration, lambda: self.status_var.set("Ready"))

    def _test_connection(self) -> None:
        """Connect or disconnect from SSH based on current state."""
        if self.connected:
            self._disconnect()
            return

        self._update_status("Connecting to VPS...", 0)

        def test():
            try:
                self.ssh_manager = SSHManager(
                    host=self.host_var.get(),
                    user=self.user_var.get(),
                    pem_key_path=self.key_var.get()
                )

                success, message = self.ssh_manager.connect()

                if success:
                    self.connection_status_var.set("Connected")
                    self.connection_status_var.set("Connected successfully")
                    self.connected = True
                    self.connect_button.config(text="Disconnect")
                    self._update_status("Connected", 3000)
                    self.root.after(0, lambda: messagebox.showinfo("Success", message))
                    self.error_logger.log_success("SSH connection established")
                else:
                    self.connection_status_var.set(f"Not connected: {message}")
                    self.connected = False
                    self.connect_button.config(text="Connect")
                    self._update_status("Connection failed", 3000)
                    self.root.after(0, lambda: messagebox.showerror("Connection Failed", message))
                    self.error_logger.log_error(f"Connection test failed: {message}")

            except Exception as e:
                self.connected = False
                self.connect_button.config(text="Connect")
                error_msg = f"Connection error: {e}"
                self.connection_status_var.set(f"Not connected: {error_msg}")
                self._update_status("Connection error", 3000)
                self.root.after(0, lambda: messagebox.showerror("Error", error_msg))
                self.error_logger.log_error(error_msg, e)

        thread = threading.Thread(target=test, daemon=True)
        thread.start()

    def _disconnect(self) -> None:
        """Disconnect SSH session."""
        if self.ssh_manager:
            try:
                self.ssh_manager.disconnect()
            except Exception:
                pass

        self.connected = False
        self.connection_status_var.set("Disconnected")
        self.connect_button.config(text="Connect")
        self._update_status("Disconnected", 2000)

    def _save_config(self) -> None:
        """Save connection configuration."""
        self.config.set("vps.host", self.host_var.get())
        self.config.set("vps.user", self.user_var.get())
        self.config.set("vps.pem_key_path", self.key_var.get())
        self.config.set("vps.remote_path", self.remote_path_var.get())
        self.config.set("local.project_root", self.project_root_var.get())
        self.config.save()
        
        messagebox.showinfo("Success", "Configuration saved")
        self.error_logger.log_info("Configuration saved")

    def _reset_config(self) -> None:
        """Reset configuration to defaults."""
        if messagebox.askyesno("Confirm", "Reset all settings to defaults?"):
            self.config.data = self.config._default_config()
            self.config.save()
            
            # Reload UI values
            self.host_var.set(self.config.get("vps.host"))
            self.user_var.set(self.config.get("vps.user"))
            self.key_var.set(self.config.get("vps.pem_key_path"))
            self.remote_path_var.set(self.config.get("vps.remote_path"))
            
            messagebox.showinfo("Success", "Configuration reset to defaults")
            self.error_logger.log_info("Configuration reset to defaults")

    def _browse_key_file(self) -> None:
        """Browse for PEM key file."""
        filename = filedialog.askopenfilename(
            title="Select PEM Key",
            filetypes=[("PEM files", "*.pem"), ("All files", "*.*")]
        )
        if filename:
            self.key_var.set(filename)

    def _browse_project_root(self) -> None:
        """Browse for project root directory."""
        dirname = filedialog.askdirectory(title="Select Project Root")
        if dirname:
            self.project_root_var.set(dirname)

    def _deploy_full(self) -> None:
        """Perform full deployment."""
        if not self.connected:
            messagebox.showerror("Not Connected", "Please connect to VPS first")
            return
        
        # Check local build FIRST before confirming deployment
        build_ok, build_msg = self._check_local_build()
        if not build_ok:
            if not messagebox.askyesno(
                "Build Check Failed",
                f"{build_msg}\n\nContinue with deployment anyway?\n"
                "(Not recommended - server deployment will likely fail)"
            ):
                self._append_deploy_output("[INFO] Deployment cancelled by user\n")
                return
        
        if not messagebox.askyesno("Confirm", "Start full deployment (upload, build, restart)?"):
            return
        
        self.deployment_in_progress = True
        self._update_status("Full deployment in progress...", 0)
        
        def deploy():
            try:
                ssh = SSHManager(
                    host=self.host_var.get(),
                    user=self.user_var.get(),
                    pem_key_path=self.key_var.get(),
                    port=self.config.get("vps.port", 22)
                )
                
                success, msg = ssh.connect()
                if not success:
                    raise Exception(f"SSH connection failed: {msg}")
                
                self._append_deploy_output(f"[OK] Connected to VPS\n")
                
                # Clear any port conflicts from other PM2/Node processes
                self._append_deploy_output(f"[INFO] Clearing port conflicts (80/443/3000)...\n")
                success, msg = ssh.clear_port_conflicts()
                if success:
                    self._append_deploy_output(f"[OK] {msg}\n")
                else:
                    self._append_deploy_output(f"[WARN] Port cleanup: {msg}\n")
                
                # Resolve project root
                source_path = self._get_project_root()
                
                self._append_deploy_output(f"[INFO] Uploading project files from {source_path}...\n")
                exclude_patterns = self.config.get("local.tar_exclude", [])
                
                success, msg = DirectUploader.upload_project(
                    ssh,
                    str(source_path),
                    self.remote_path_var.get(),
                    exclude_patterns,
                    progress_callback=self._append_deploy_output
                )
                
                if not success:
                    raise Exception(f"Upload failed: {msg}")
                
                self._append_deploy_output(f"[OK] Files uploaded successfully\n")
                
                # Run remote management script (this will now trigger a reboot)
                self._append_deploy_output("\n[INFO] Building and initiating server reboot...\n")
                self._append_deploy_output("[INFO] NOTE: Connection will be lost as the server restarts.\n")
                
                remote_script = f"{self.remote_path_var.get()}/live-deployment/remote-manage.sh"
                
                # We expect a potential exception or non-zero code due to the connection dropping
                try:
                    returncode, stdout, stderr = ssh.run_deployment_script(
                        remote_script,
                        "all",
                        progress_callback=self._append_deploy_output
                    )
                except Exception as e:
                    # If we got a connection error after sending the command, it's likely success
                    if "closed" in str(e).lower() or "connection" in str(e).lower():
                        returncode = 0
                        stderr = ""
                        self._append_deploy_output("\n[INFO] Connection closed (Reboot started)\n")
                    else:
                        raise e

                # Check for build errors (before reboot)
                # If we have returncode 1 but output mentions rebooting or connection issues,
                # we treat it as success because the server went down before sending return 0.
                if returncode != 0:
                    if "reboot" in stdout.lower() or "reboot" in stderr.lower() or "connection" in stderr.lower():
                        self._append_deploy_output("[INFO] Reboot confirmed via output analysis.\n")
                        returncode = 0
                        build_failed = False
                    else:
                        build_failed = "error" in stderr.lower() or "failed" in stderr.lower()
                else:
                    build_failed = False
                
                if build_failed:
                    self._append_deploy_output(f"\n[✗] Build may have failed (returncode: {returncode})\n")
                    self._append_deploy_output("[INFO] Checking for auto-recovery options...\n")
                    error_msg = f"Build failed on server.\nSTDERR:\n{stderr[:500]}"
                    
                    # Ask user if they want auto-recovery
                    should_recover = messagebox.askyesno(
                        "Build Failed - Auto-Recovery",
                        "Build failed on server. Run auto-recovery fix?\n"
                        "This will rebuild and restart services."
                    )
                    
                    if should_recover:
                        self._append_deploy_output("\n[INFO] Running auto-recovery (complete fix)...\n")
                        returncode, stdout, stderr = ssh.run_deployment_script(
                            f"{self.remote_path_var.get()}/deploy-complete-fix.sh",
                            "",
                            progress_callback=self._append_deploy_output
                        )
                        
                        if returncode == 0:
                            self._append_deploy_output("\n[✓] Auto-recovery completed successfully\n")
                            messagebox.showinfo("Recovery Success", "Auto-recovery completed. Services should now be running.")
                        else:
                            raise Exception(f"Auto-recovery failed:\n{stderr}")
                    else:
                        raise Exception(error_msg)
                
                self._append_deploy_output("\n[OK] Build and restart completed\n")
                
                # Upload the complete fix script
                self._append_deploy_output("\n[INFO] Uploading asset serving fix script...\n")
                fix_script = source_path / "deploy-complete-fix.sh"
                if fix_script.exists():
                    remote_fix = f"{self.remote_path_var.get()}/deploy-complete-fix.sh"
                    success, msg = ssh.upload_file(str(fix_script), remote_fix)
                    if success:
                        self._append_deploy_output("[OK] Fix script uploaded\n")
                        
                        # Ask user if they want to apply the complete fix now
                        self.root.after(0, lambda: self._ask_apply_fix(ssh))
                    else:
                        self._append_deploy_output(f"[WARN] Could not upload fix script: {msg}\n")
                else:
                    self._append_deploy_output("[WARN] deploy-complete-fix.sh not found in project\n")
                
                self._append_deploy_output("\n✓ Deployment completed successfully!\n")
                self.error_logger.log_success("Full deployment completed")
                
                ssh.disconnect()
                
                self.root.after(0, lambda: messagebox.showinfo("Success", "Deployment completed successfully!"))
            
            except Exception as e:
                error_msg = f"Deployment failed: {e}"
                self._append_deploy_output(f"\n[ERROR] {error_msg}\n")
                self.error_logger.log_error(error_msg, e, copy_to_clipboard=True)
                self.root.after(0, lambda: messagebox.showerror("Deployment Failed", error_msg))
            
            finally:
                self.deployment_in_progress = False
                self._update_status("Ready")
        
        thread = threading.Thread(target=deploy, daemon=True)
        thread.start()

    def _ask_apply_fix(self, ssh: SSHManager) -> None:
        """Ask user if they want to apply the complete fix now."""
        if messagebox.askyesno("Apply Asset Serving Fix", 
                               "Would you like to apply the asset serving and Nginx fix now?\n\n"
                               "This will configure static asset serving and the reverse proxy."):
            self._apply_complete_fix(ssh)

    def _apply_complete_fix(self, ssh: SSHManager) -> None:
        """Apply the complete fix on an already connected SSH session."""
        self.deployment_in_progress = True
        self._update_status("Applying complete asset fix...", 0)
        
        def execute():
            try:
                self._append_deploy_output("\n[INFO] Applying complete asset serving fix...\n")
                
                remote_script = f"{self.remote_path_var.get()}/deploy-complete-fix.sh"
                returncode, stdout, stderr = ssh.run_deployment_script(
                    remote_script,
                    "",
                    progress_callback=self._append_deploy_output
                )
                
                if returncode == 0:
                    self._append_deploy_output("\n✓ Asset serving fix applied successfully!\n")
                    self._append_deploy_output("Nginx is now serving your application.\n")
                    self._append_deploy_output("Access at: http://" + self.host_var.get() + "\n")
                    self.error_logger.log_success("Asset serving fix applied")
                    self.root.after(0, lambda: messagebox.showinfo("Success", "Asset serving fix applied successfully!"))
                else:
                    combined = f"Fix failed with code {returncode}:\nSTDOUT:\n{stdout}\nSTDERR:\n{stderr}"
                    raise Exception(combined)
            
            except Exception as e:
                error_msg = f"Fix application failed: {e}"
                self._append_deploy_output(f"\n✗ ERROR: {error_msg}\n")
                self.error_logger.log_error(error_msg, e)
                self.root.after(0, lambda: messagebox.showerror("Error", error_msg))
            
            finally:
                self.deployment_in_progress = False
                self._update_status("Ready")
        
        thread = threading.Thread(target=execute, daemon=True)
        thread.start()


    def _run_remote_command(self, command: str, description: str) -> None:
        """Run a remote management command.
        
        Args:
            command: Command to run (update, build, restart)
            description: Description for output
        """
        self.deployment_in_progress = True
        self._update_status(f"Executing {command}...", 0)
        
        def execute():
            try:
                ssh = SSHManager(
                    host=self.host_var.get(),
                    user=self.user_var.get(),
                    pem_key_path=self.key_var.get(),
                    port=self.config.get("vps.port", 22)
                )
                
                success, msg = ssh.connect()
                if not success:
                    raise Exception(f"SSH connection failed: {msg}")
                
                self._append_deploy_output(f"▶ {description}\n")
                
                remote_script = f"{self.remote_path_var.get()}/live-deployment/remote-manage.sh"
                
                try:
                    returncode, stdout, stderr = ssh.run_deployment_script(
                        remote_script,
                        command,
                        progress_callback=self._append_deploy_output
                    )
                except Exception as e:
                    # Connection loss is expected when rebooting
                    if command == "reboot" and ("closed" in str(e).lower() or "connection" in str(e).lower()):
                        returncode = 0
                        stdout = "Reboot initiated"
                        stderr = ""
                    else:
                        raise e
                
                # Further check if reboot was successful despite non-zero code from session drop
                if command == "reboot" and returncode != 0 and ("reboot" in stdout.lower() or "connection" in stdout.lower()):
                    returncode = 0
                
                ssh.disconnect()
                
                if returncode == 0:
                    self._append_deploy_output(f"\n✓ {command.capitalize()} completed successfully!\n")
                    self.error_logger.log_success(f"{command.capitalize()} command executed")
                    self.root.after(0, lambda: messagebox.showinfo("Success", f"{command} completed"))
                else:
                    combined = f"Command failed with code {returncode}:\nSTDOUT:\n{stdout}\nSTDERR:\n{stderr}"
                    raise Exception(combined)
            
            except Exception as e:
                error_msg = f"Command execution failed: {e}"
                self._append_deploy_output(f"\n✗ {error_msg}\n")
                self.error_logger.log_error(error_msg, e)
                self.root.after(0, lambda: messagebox.showerror("Error", error_msg))
            
            finally:
                self.deployment_in_progress = False
                self._update_status("Ready")
        
        thread = threading.Thread(target=execute, daemon=True)
        thread.start()

    def _append_deploy_output(self, text: str) -> None:
        """Append text to deployment output.
        
        Args:
            text: Text to append
        """
        def append():
            self.deploy_output.insert(tk.END, text)
            self.deploy_output.see(tk.END)
            self.root.update()
        
        self.root.after(0, append)

    def _copy_deploy_output(self) -> None:
        """Copy deployment output to clipboard."""
        try:
            content = self.deploy_output.get("1.0", tk.END)
            pyperclip.copy(content)
            messagebox.showinfo("Copied", "Deployment output copied to clipboard")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to copy: {e}")

    def _start_services(self) -> None:
        """Start services (PM2 start/restart)."""
        if not self.connected:
            messagebox.showerror("Not Connected", "Please connect to VPS first")
            return
        
        self.deployment_in_progress = True
        self._update_status("Starting services...", 0)
        
        def execute():
            try:
                ssh = SSHManager(
                    host=self.host_var.get(),
                    user=self.user_var.get(),
                    pem_key_path=self.key_var.get(),
                    port=self.config.get("vps.port", 22)
                )
                
                success, msg = ssh.connect()
                if not success:
                    raise Exception(f"SSH connection failed: {msg}")
                
                self._append_deploy_output("▶ Starting services...\n")
                
                # Start PM2 services
                cmd = "cd /home/admin/Scootware-Forum && pm2 start ecosystem.config.cjs --update-env && pm2 save"
                returncode, stdout, stderr = ssh.execute_command(cmd)
                
                self._append_deploy_output(stdout)
                if stderr:
                    self._append_deploy_output(f"[STDERR] {stderr}")
                
                # Reload nginx
                ssh.execute_command("sudo systemctl reload nginx")
                
                ssh.disconnect()
                
                if returncode == 0:
                    self._append_deploy_output("\n✓ Services started successfully!\n")
                    self.error_logger.log_success("Services started")
                    self.root.after(0, lambda: messagebox.showinfo("Success", "Services started successfully"))
                else:
                    raise Exception(f"Failed to start services: {stderr}")
            
            except Exception as e:
                error_msg = f"Failed to start services: {e}"
                self._append_deploy_output(f"\n✗ {error_msg}\n")
                self.error_logger.log_error(error_msg, e)
                self.root.after(0, lambda: messagebox.showerror("Error", error_msg))
            
            finally:
                self.deployment_in_progress = False
                self._update_status("Ready")
        
        thread = threading.Thread(target=execute, daemon=True)
        thread.start()

    def _stop_services(self) -> None:
        """Stop services (PM2 stop)."""
        if not self.connected:
            messagebox.showerror("Not Connected", "Please connect to VPS first")
            return
        
        # Confirm action
        if messagebox.askyesno("Confirm", "Are you sure you want to stop all services?"):
            self.deployment_in_progress = True
            self._update_status("Stopping services...", 0)
            
            def execute():
                try:
                    ssh = SSHManager(
                        host=self.host_var.get(),
                        user=self.user_var.get(),
                        pem_key_path=self.key_var.get(),
                        port=self.config.get("vps.port", 22)
                    )
                    
                    success, msg = ssh.connect()
                    if not success:
                        raise Exception(f"SSH connection failed: {msg}")
                    
                    self._append_deploy_output("▶ Stopping services...\n")
                    
                    # Stop PM2 services
                    cmd = "pm2 stop all && pm2 save"
                    returncode, stdout, stderr = ssh.execute_command(cmd)
                    
                    self._append_deploy_output(stdout)
                    if stderr:
                        self._append_deploy_output(f"[STDERR] {stderr}")
                    
                    ssh.disconnect()
                    
                    if returncode == 0:
                        self._append_deploy_output("\n✓ Services stopped successfully!\n")
                        self.error_logger.log_success("Services stopped")
                        self.root.after(0, lambda: messagebox.showinfo("Success", "Services stopped successfully"))
                    else:
                        raise Exception(f"Failed to stop services: {stderr}")
                
                except Exception as e:
                    error_msg = f"Failed to stop services: {e}"
                    self._append_deploy_output(f"\n✗ {error_msg}\n")
                    self.error_logger.log_error(error_msg, e)
                    self.root.after(0, lambda: messagebox.showerror("Error", error_msg))
                
                finally:
                    self.deployment_in_progress = False
                    self._update_status("Ready")
            
            thread = threading.Thread(target=execute, daemon=True)
            thread.start()

    def _check_api_health(self) -> None:
        """Check API health status."""
        self._update_status("Checking API health...", 0)
        
        def check():
            try:
                self.health_monitor = HealthMonitor(
                    self.api_url_var.get(),
                    self.config.get("api.health_check_timeout", 5)
                )
                
                is_healthy, details = self.health_monitor.check_api_health()
                
                status_text = "✓ Healthy" if is_healthy else "✗ Unhealthy"
                status_msg = f"{status_text} - Status Code: {details.get('status_code', 'N/A')}, Response Time: {details.get('response_time_ms', 'N/A')}ms"
                
                self.api_status_var.set(f"Status: {status_msg}")
                self.error_logger.log_info(f"API health check: {status_msg}")
                self.root.after(0, lambda: messagebox.showinfo("API Status", status_msg))
            
            except Exception as e:
                error_msg = f"Health check failed: {e}"
                self.api_status_var.set(f"Status: Error - {error_msg}")
                self.error_logger.log_error(error_msg, e)
                self.root.after(0, lambda: messagebox.showerror("Error", error_msg))
            
            finally:
                self._update_status("Ready")
        
        thread = threading.Thread(target=check, daemon=True)
        thread.start()

    def _check_full_diagnostics(self) -> None:
        """Run full system diagnostics."""
        if not self.connected:
            messagebox.showerror("Not Connected", "Please connect to VPS first")
            return
        
        self._update_status("Running diagnostics...", 0)
        self.health_output.delete("1.0", tk.END)
        
        def diagnose():
            try:
                self.health_monitor = HealthMonitor(
                    self.api_url_var.get(),
                    self.config.get("api.health_check_timeout", 5)
                )
                
                ssh = SSHManager(
                    host=self.host_var.get(),
                    user=self.user_var.get(),
                    pem_key_path=self.key_var.get(),
                    port=self.config.get("vps.port", 22)
                )
                
                success, msg = ssh.connect()
                if not success:
                    raise Exception(f"SSH connection failed: {msg}")
                
                self._append_health_output("🔍 Running full diagnostics...\n\n")
                
                diagnostics = self.health_monitor.get_full_diagnostics(ssh)
                
                # Format and display
                formatted = HealthMonitor.format_diagnostics_for_clipboard(diagnostics)
                self._append_health_output(formatted + "\n")
                
                ssh.disconnect()
                self.error_logger.log_info("Full diagnostics completed")
                self._update_status("Diagnostics completed")
            
            except Exception as e:
                error_msg = f"Diagnostics failed: {e}"
                self._append_health_output(f"\n✗ Error: {error_msg}\n")
                self.error_logger.log_error(error_msg, e)
                self._update_status("Diagnostics failed")
        
        thread = threading.Thread(target=diagnose, daemon=True)
        thread.start()

    def _append_health_output(self, text: str) -> None:
        """Append text to health output.
        
        Args:
            text: Text to append
        """
        def append():
            self.health_output.insert(tk.END, text)
            self.health_output.see(tk.END)
            self.root.update()
        
        self.root.after(0, append)

    def _copy_health_output(self) -> None:
        """Copy health output to clipboard."""
        try:
            content = self.health_output.get("1.0", tk.END)
            pyperclip.copy(content)
            messagebox.showinfo("Copied", "Health status copied to clipboard")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to copy: {e}")

    def _copy_diagnostics_formatted(self) -> None:
        """Copy formatted diagnostics for support."""
        try:
            content = self.health_output.get("1.0", tk.END)
            if not content.strip():
                messagebox.showwarning("Empty", "Run diagnostics first")
                return
            
            pyperclip.copy(content)
            messagebox.showinfo("Copied for Support", "Formatted diagnostics copied to clipboard\n\nYou can now share this with support for troubleshooting")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to copy: {e}")

    def _refresh_logs(self) -> None:
        """Refresh logs display."""
        logs = self.error_logger.get_recent_logs(200)
        self.logs_output.delete("1.0", tk.END)
        self.logs_output.insert(tk.END, logs)
        self.logs_output.see(tk.END)

    def _clear_logs(self) -> None:
        """Clear logs display."""
        if messagebox.askyesno("Confirm", "Clear all logs?"):
            # Delete the log file
            log_path = Path(self.error_logger.log_file)
            if log_path.exists():
                log_path.unlink()
            
            self.error_logger.logger.handlers.clear()
            self.error_logger = ErrorLogger(self.config.get("logging.log_file"))
            self.logs_output.delete("1.0", tk.END)
            messagebox.showinfo("Success", "Logs cleared")

    def _copy_logs(self) -> None:
        """Copy logs to clipboard."""
        try:
            content = self.logs_output.get("1.0", tk.END)
            pyperclip.copy(content)
            messagebox.showinfo("Copied", "Logs copied to clipboard")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to copy: {e}")

    def _open_log_file(self) -> None:
        """Open log file in default viewer."""
        log_path = Path(self.error_logger.log_file)
        if log_path.exists():
            os.startfile(str(log_path))
        else:
            messagebox.showwarning("Not Found", "Log file does not exist yet")

    def _save_settings(self) -> None:
        """Save application settings."""
        self.config.set("api.health_check_url", self.settings_api_url.get())
        self.config.set("api.health_check_timeout", self.settings_timeout.get())
        self.config.set("logging.log_file", self.settings_log_file.get())
        self.config.save()
        
        messagebox.showinfo("Success", "Settings saved")
        self.error_logger.log_info("Settings updated")


def main():
    """Main entry point."""
    root = tk.Tk()
    app = DeploymentGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
