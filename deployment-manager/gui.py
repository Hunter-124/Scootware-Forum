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
    def _deploy_complete_upload_cycle(self) -> None:
        """Complete upload cycle: Stop services -> Upload -> Build -> Restart."""
        if not self.connected:
            messagebox.showerror("Not Connected", "Please connect to VPS first")
            return
        
        if not messagebox.askyesno(
            "Complete Upload Cycle",
            "This will execute the complete deployment cycle:\n\n" +
            "1. Stop all services (free up processing power)\n" +
            "2. Upload project files\n" +
            "3. Build project\n" +
            "4. Restart services\n\n" +
            "Continue?"
        ):
            return
        
        self.deployment_in_progress = True
        self.stop_deployment = False
        self._update_stop_button_state()
        self._update_status("Starting complete upload cycle...", 0)
        
        def execute():
            try:
                ssh = SSHManager(
                    host=self.host_var.get(),
                    user=self.user_var.get(),
                    pem_key_path=self.key_var.get(),
                    port=self.config.get("vps.port", 22)
                )
                
                self.current_ssh_session = ssh
                
                if self.stop_deployment:
                    return
                
                success, msg = ssh.connect()
                if not success:
                    raise Exception(f"SSH connection failed: {msg}")
                
                self._append_deploy_output("\n" + "="*60 + "\n")
                self._append_deploy_output("[ONE-CLICK DEPLOYMENT CYCLE] Starting...\n")
                self._append_deploy_output("="*60 + "\n\n")
                
                # STEP 1: Stop Services
                self._append_deploy_output("[STEP 1/4] Stopping all services...\n")
                self._append_deploy_output("-" * 60 + "\n")
                
                if self.stop_deployment:
                    self._append_deploy_output("\n[⚠️ STOPPED] Deployment cancelled by user\n")
                    ssh.disconnect()
                    return
                
                self._append_deploy_output("[1/4] Removing PM2 apps...\n")
                ssh.execute_command("pm2 delete all 2>/dev/null || true")
                self._append_deploy_output("[1/4] Killing PM2 daemon...\n")
                ssh.execute_command("pm2 kill 2>/dev/null || true")
                self._append_deploy_output("[1/4] Killing lingering Node.js processes...\n")
                ssh.execute_command("pkill -f 'node|boot.mjs' 2>/dev/null || true")
                self._append_deploy_output("[1/4] Stopping Nginx...\n")
                ssh.execute_command("sudo systemctl stop nginx 2>/dev/null || true")
                self._append_deploy_output("[✓] All services stopped successfully\n\n")
                
                if self.stop_deployment:
                    self._append_deploy_output("\n[⚠️ STOPPED] Deployment cancelled by user\n")
                    ssh.disconnect()
                    return
                
                # STEP 2: Upload Files
                self._append_deploy_output("[STEP 2/4] Uploading project files...\n")
                self._append_deploy_output("-" * 60 + "\n")
                
                source_path = self._get_project_root()
                remote_path = self.remote_path_var.get()
                
                self._validate_and_log_paths(source_path, remote_path)
                
                if self.stop_deployment:
                    self._append_deploy_output("\n[⚠️ STOPPED] Deployment cancelled by user during upload\n")
                    ssh.disconnect()
                    return
                
                exclude_patterns = self.config.get("local.tar_exclude", [])
                self._append_deploy_output(f"[INFO] Exclude patterns: {len(exclude_patterns)} rules\n")
                
                success, msg = DirectUploader.upload_project(
                    ssh,
                    str(source_path),
                    remote_path,
                    exclude_patterns,
                    progress_callback=self._append_deploy_output
                )
                
                if self.stop_deployment:
                    self._append_deploy_output("\n[⚠️ STOPPED] Deployment cancelled by user during upload\n")
                    ssh.disconnect()
                    return
                
                if not success:
                    raise Exception(f"Upload failed: {msg}")
                
                self._append_deploy_output("[✓] Files uploaded successfully\n\n")
                
                if self.stop_deployment:
                    self._append_deploy_output("\n[⚠️ STOPPED] Deployment cancelled by user before build\n")
                    ssh.disconnect()
                    return
                
                # STEP 3: Build Project
                self._append_deploy_output("[STEP 3/4] Building project...\n")
                self._append_deploy_output("-" * 60 + "\n")
                
                remote_script = f"{remote_path}/live-deployment/remote-manage.sh"
                returncode, stdout, stderr = ssh.run_deployment_script(
                    remote_script,
                    "build",
                    progress_callback=self._append_deploy_output
                )
                
                if self.stop_deployment:
                    self._append_deploy_output("\n[⚠️ STOPPED] Deployment cancelled by user during build\n")
                    ssh.disconnect()
                    return
                
                if returncode != 0:
                    raise Exception(f"Build failed with code {returncode}: {stderr}")
                
                self._append_deploy_output("[✓] Build completed successfully\n\n")
                
                if self.stop_deployment:
                    self._append_deploy_output("\n[⚠️ STOPPED] Deployment cancelled by user before restart\n")
                    ssh.disconnect()
                    return
                
                # STEP 4: Restart Services
                self._append_deploy_output("[STEP 4/4] Restarting services...\n")
                self._append_deploy_output("-" * 60 + "\n")
                
                self._append_deploy_output("[4/4] Running: remote-manage.sh restart\n")
                returncode, stdout, stderr = ssh.run_deployment_script(
                    remote_script,
                    "restart",
                    progress_callback=self._append_deploy_output
                )
                
                if self.stop_deployment:
                    self._append_deploy_output("\n[⚠️ STOPPED] Deployment cancelled by user during restart\n")
                    ssh.disconnect()
                    return
                
                if returncode != 0:
                    raise Exception(f"Restart failed with code {returncode}: {stderr}")
                
                self._append_deploy_output("[✓] Services restarted successfully via remote-manage.sh\n\n")
                
                # Final Summary
                self._append_deploy_output("\n" + "="*60 + "\n")
                self._append_deploy_output("[✓] COMPLETE DEPLOYMENT CYCLE FINISHED\n")
                self._append_deploy_output("="*60 + "\n\n")
                self._append_deploy_output("Steps executed:\n")
                self._append_deploy_output("  ✓ Stopped all services\n")
                self._append_deploy_output("  ✓ Uploaded project files\n")
                self._append_deploy_output("  ✓ Built project\n")
                self._append_deploy_output("  ✓ Restarted services\n\n")
                
                ssh.disconnect()
                
                self.error_logger.log_success("Complete upload cycle finished successfully")
                self.root.after(0, lambda: messagebox.showinfo("Success", "One-click deployment cycle completed successfully!\n\nAll services are now running."))
            
            except Exception as e:
                error_msg = f"Deployment cycle failed: {e}"
                self._append_deploy_output(f"\n[✗] ERROR: {error_msg}\n")
                self.error_logger.log_error(error_msg, e)
                self.root.after(0, lambda: messagebox.showerror("Deployment Failed", error_msg))
            
            finally:
                if ssh in locals():
                    try:
                        ssh.disconnect()
                    except:
                        pass
                self.current_ssh_session = None
                self.deployment_in_progress = False
                self.stop_deployment = False
                self._update_stop_button_state()
                self._update_status("Ready")
        
        thread = threading.Thread(target=execute, daemon=True)
        thread.start()

    def _clear_hashcache_and_full_upload(self) -> None:
        """Clear the hashcache and upload all files (start hashcache fresh)."""
        if not self.connected:
            messagebox.showerror("Not Connected", "Please connect to VPS first")
            return

        if not messagebox.askyesno("Confirm", "Clear hashcache and upload ALL files to VPS?\n\nThis will force a full upload and reset the upload cache."):
            return

        self.deployment_in_progress = True
        self.stop_deployment = False
        self._update_stop_button_state()
        self._update_status("Clearing hashcache and uploading all files...", 0)

        def action():
            try:
                if not self.ssh_manager:
                    raise Exception("SSH manager not initialized")

                self.current_ssh_session = self.ssh_manager

                if self.stop_deployment:
                    return

                # Resolve project root
                source_path = self._get_project_root()
                remote_path = self.remote_path_var.get()
                
                # Validate and debug paths
                self._validate_and_log_paths(source_path, remote_path)

                if self.stop_deployment:
                    self._append_deploy_output("\n[⚠️ STOPPED] Operation cancelled by user\n")
                    return
                
                cache_file = source_path / ".deploy_cache.json"
                # Remove hashcache file if it exists
                if cache_file.exists():
                    cache_file.unlink()
                    self._append_deploy_output("[INFO] Cleared .deploy_cache.json (hashcache)\n")
                else:
                    self._append_deploy_output("[INFO] No hashcache file found, starting fresh\n")

                exclude_patterns = self.config.get("local.tar_exclude", [])
                self._append_deploy_output(f"[INFO] Exclude patterns: {len(exclude_patterns)} rules\n")

                if self.stop_deployment:
                    self._append_deploy_output("\n[⚠️ STOPPED] Operation cancelled by user\n")
                    return

                success, msg = DirectUploader.upload_project(
                    self.ssh_manager,
                    str(source_path),
                    remote_path,
                    exclude_patterns,
                    progress_callback=self._append_deploy_output
                )

                if self.stop_deployment:
                    self._append_deploy_output("\n[⚠️ STOPPED] Operation cancelled by user\n")
                    return

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
                self.current_ssh_session = None
                self.deployment_in_progress = False
                self.stop_deployment = False
                self._update_stop_button_state()
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
        # This ensures the tool works correctly regardless of how it's launched (terminal, shortcut, etc.)
        if not root_path.is_absolute():
            # Get the directory where this script (gui.py) is located
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

    def _validate_and_log_paths(self, source_path: Path, remote_path: str) -> None:
        """Validate paths and log them for debugging deployment issues."""
        resolved_source = source_path.resolve()
        
        # Check if source exists
        if not resolved_source.is_dir():
            raise Exception(f"Source directory does not exist: {resolved_source}")
        
        # Log path information
        self._append_deploy_output(f"\n[DEBUG] === PATH CONFIGURATION ===\n")
        self._append_deploy_output(f"[DEBUG] Local Source (absolute): {resolved_source}\n")
        self._append_deploy_output(f"[DEBUG] Remote Path (on server): {remote_path}\n")
        
        # Verify key directories exist
        key_dirs = ['lib', 'artifacts']
        for key_dir in key_dirs:
            full_path = resolved_source / key_dir
            if full_path.exists():
                self._append_deploy_output(f"[DEBUG] [OK] Found {key_dir}/ in source\n")
            else:
                self._append_deploy_output(f"[DEBUG] [WARN] Missing {key_dir}/ in source\n")
        
        # Check critical files
        critical_files = ['package.json', 'boot.mjs', 'ecosystem.config.cjs']
        for crit_file in critical_files:
            full_path = resolved_source / crit_file
            if full_path.exists():
                self._append_deploy_output(f"[DEBUG] [OK] Found {crit_file}\n")
            else:
                self._append_deploy_output(f"[DEBUG] [WARN] Missing {crit_file}\n")
        
        self._append_deploy_output(f"[DEBUG] === END PATH VALIDATION ===\n\n")

    def __init__(self, root):
        self.root = root
        self.config = Config()
        self.error_logger = ErrorLogger(self.config.get("logging.log_file"))
        self.connected = False
        self.ssh_manager = None
        self.deployment_in_progress = False
        self.stop_deployment = False
        self.current_ssh_session = None
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
        self.stop_deployment = False
        self._update_stop_button_state()
        self._update_status("Uploading new code files...", 0)

        def action():
            try:
                if not self.ssh_manager:
                    raise Exception("SSH manager not initialized")

                self.current_ssh_session = self.ssh_manager
                
                if self.stop_deployment:
                    return

                # Resolve project root
                source_path = self._get_project_root()
                remote_path = self.remote_path_var.get()
                
                # Validate and debug paths
                self._validate_and_log_paths(source_path, remote_path)

                if self.stop_deployment:
                    self._append_deploy_output("\n[⚠️ STOPPED] Upload cancelled by user\n")
                    return

                exclude_patterns = self.config.get("local.tar_exclude", [])
                self._append_deploy_output(f"[INFO] Exclude patterns: {len(exclude_patterns)} rules\n")

                success, msg = DirectUploader.upload_project(
                    self.ssh_manager,
                    str(source_path),
                    remote_path,
                    exclude_patterns,
                    progress_callback=self._append_deploy_output
                )

                if self.stop_deployment:
                    self._append_deploy_output("\n[⚠️ STOPPED] Upload cancelled by user\n")
                    return

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
                self.current_ssh_session = None
                self.deployment_in_progress = False
                self.stop_deployment = False
                self._update_stop_button_state()
                self._update_status("Ready")

        thread = threading.Thread(target=action, daemon=True)
        thread.start()

    def _deploy_complete_fix(self) -> None:
        """Run complete asset and nginx fix on server."""
        if not self.connected:
            messagebox.showerror("Not Connected", "Please connect to VPS first")
            return

        if not messagebox.askyesno("Confirm", "Deploy complete asset serving fix?\n\nThis will:\n1. Rebuild the API with port 3000\n2. Configure Nginx reverse proxy\n3. Set up static asset serving\n\nContinue?"):
            return

        self.deployment_in_progress = True
        self.stop_deployment = False
        self._update_stop_button_state()
        self._update_status("Deploying complete fix...", 0)

        def execute():
            try:
                ssh = SSHManager(
                    host=self.host_var.get(),
                    user=self.user_var.get(),
                    pem_key_path=self.key_var.get(),
                    port=self.config.get("vps.port", 22)
                )
                
                self.current_ssh_session = ssh
                
                if self.stop_deployment:
                    return
                
                success, msg = ssh.connect()
                if not success:
                    raise Exception(f"SSH connection failed: {msg}")
                
                self._append_deploy_output("[INFO] Deploying complete asset serving fix...\n")
                
                if self.stop_deployment:
                    self._append_deploy_output("\n[⚠️ STOPPED] Operation cancelled by user\n")
                    return
                
                remote_script = f"{self.remote_path_var.get()}/deploy-complete-fix.sh"
                returncode, stdout, stderr = ssh.run_deployment_script(
                    remote_script,
                    "",
                    progress_callback=self._append_deploy_output
                )
                
                if self.stop_deployment:
                    self._append_deploy_output("\n[⚠️ STOPPED] Operation cancelled by user\n")
                    ssh.disconnect()
                    return
                
                ssh.disconnect()
                
                if returncode == 0:
                    self._append_deploy_output("\n✓ Complete fix deployed successfully!\n")
                    self._append_deploy_output("\nAssets should now be loading correctly.\n")
                    self._append_deploy_output("Access at: http://" + self.host_var.get() + "\n")
                    self.error_logger.log_success("Complete asset fix deployed")
                    self.root.after(0, lambda: messagebox.showinfo("Success", "Asset serving fix deployed successfully!\n\nAccess at: http://" + self.host_var.get()))
                else:
                    combined = f"Fix deployment failed with code {returncode}:\nSTDOUT:\n{stdout}\nSTDERR:\n{stderr}"
                    raise Exception(combined)
            
            except Exception as e:
                error_msg = f"Fix deployment failed: {e}"
                self._append_deploy_output(f"\n✗ ERROR: {error_msg}\n")
                self.error_logger.log_error(error_msg, e)
                self.root.after(0, lambda: messagebox.showerror("Error", error_msg))
            
            finally:
                self.current_ssh_session = None
                self.deployment_in_progress = False
                self.stop_deployment = False
                self._update_stop_button_state()
                self._update_status("Ready")

        thread = threading.Thread(target=execute, daemon=True)
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

        # Full deployment header with title and one-click button on the right
        full_deploy_header = tk.Frame(deploy_frame)
        full_deploy_header.pack(anchor=tk.W, padx=10, pady=(10, 5), fill=tk.X)
        ttk.Label(full_deploy_header, text="📦 Full Deployment", font=("Arial", 12, "bold")).pack(side=tk.LEFT)
        
        # One-click complete upload cycle button (top right)
        complete_cycle_btn = tk.Button(
            full_deploy_header,
            text="🚀 ONE-CLICK: Stop → Upload → Build → Restart",
            command=self._deploy_complete_upload_cycle,
            bg="#FF6B6B",
            fg="white",
            font=("Arial", 10, "bold"),
            padx=15,
            pady=8,
            relief=tk.RAISED,
            cursor="hand2"
        )
        complete_cycle_btn.pack(side=tk.RIGHT, padx=5)
        
        ttk.Label(deploy_frame, text="Uploads entire project, builds, restarts services, and applies the complete Nginx/static asset fix.").pack(anchor=tk.W, padx=20, pady=5)
        full_upload_frame = ttk.Frame(deploy_frame)
        full_upload_frame.pack(anchor=tk.W, padx=20, pady=5)
        ttk.Button(full_upload_frame, text="Full Upload (All Files)", command=self._deploy_full).pack(side=tk.LEFT, padx=5)
        ttk.Button(full_upload_frame, text="Partial Upload (Changed Files)", command=self._deploy_upload_new_files).pack(side=tk.LEFT, padx=5)
        ttk.Button(full_upload_frame, text="Clear HashCache & Full Upload", command=self._clear_hashcache_and_full_upload).pack(side=tk.LEFT, padx=5)

        # Step-by-step deployment
        ttk.Label(deploy_frame, text="Or run steps individually:", font=("Arial", 10, "italic")).pack(anchor=tk.W, padx=20, pady=(15, 2))
        step_frame = ttk.Frame(deploy_frame)
        step_frame.pack(anchor=tk.W, padx=30, pady=2, fill=tk.X)
        ttk.Button(step_frame, text="0. Install Dependencies", command=lambda: self._run_remote_command("update", "Installing dependencies...")).pack(side=tk.LEFT, padx=2)
        ttk.Button(step_frame, text="1. Upload Project Files (Changed Only)", command=self._deploy_upload_new_files).pack(side=tk.LEFT, padx=2)
        ttk.Button(step_frame, text="2. Build Project", command=lambda: self._run_remote_command("build", "Building project...")).pack(side=tk.LEFT, padx=2)
        ttk.Button(step_frame, text="3. Restart & Verify", command=self._deploy_api_full).pack(side=tk.LEFT, padx=2)
        ttk.Button(step_frame, text="4. Apply Asset/Nginx Fix", command=self._deploy_complete_fix).pack(side=tk.LEFT, padx=2)
        # Service control
        ttk.Label(deploy_frame, text="⚡ Service Controls", font=("Arial", 12, "bold")).pack(anchor=tk.W, padx=10, pady=(15, 5))
        service_frame = ttk.Frame(deploy_frame)
        service_frame.pack(anchor=tk.W, padx=20, pady=5, fill=tk.X)
        ttk.Button(service_frame, text="Restart Services", command=self._deploy_api_full).pack(side=tk.LEFT, padx=5)
        ttk.Button(service_frame, text="Quick Restart (PM2 only)", command=self._deploy_restart).pack(side=tk.LEFT, padx=5)
        ttk.Button(service_frame, text="Start Services", command=self._start_services).pack(side=tk.LEFT, padx=5)
        ttk.Button(service_frame, text="Stop Services", command=self._stop_services).pack(side=tk.LEFT, padx=5)
        # Output
        ttk.Label(deploy_frame, text="Output:", font=("Arial", 10, "bold")).pack(anchor=tk.W, padx=10, pady=(15, 5))
        self.deploy_output = scrolledtext.ScrolledText(deploy_frame, height=15, width=80)
        self.deploy_output.pack(padx=10, pady=5, fill=tk.BOTH, expand=True)
        # Control buttons
        control_frame = ttk.Frame(deploy_frame)
        control_frame.pack(padx=10, pady=10, fill=tk.X)
        ttk.Button(control_frame, text="Clear Output", command=lambda: self.deploy_output.delete("1.0", tk.END)).pack(side=tk.LEFT, padx=5)
        ttk.Button(control_frame, text="Copy Output", command=self._copy_deploy_output).pack(side=tk.LEFT, padx=5)
        
        # Stop button (styled as warning/danger)
        self.stop_button = ttk.Button(control_frame, text="⏹ Stop Current Operation", command=self._stop_current_operation, state=tk.DISABLED)
        self.stop_button.pack(side=tk.LEFT, padx=5)

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
        self.stop_deployment = False
        self._update_stop_button_state()
        self._update_status("Full deployment in progress...", 0)
        
        def deploy():
            try:
                ssh = SSHManager(
                    host=self.host_var.get(),
                    user=self.user_var.get(),
                    pem_key_path=self.key_var.get(),
                    port=self.config.get("vps.port", 22)
                )
                
                self.current_ssh_session = ssh
                
                if self.stop_deployment:
                    return
                
                success, msg = ssh.connect()
                if not success:
                    raise Exception(f"SSH connection failed: {msg}")
                
                self._append_deploy_output(f"[OK] Connected to VPS\n")
                
                # Resolve project root
                source_path = self._get_project_root()
                remote_path = self.remote_path_var.get()
                
                # Validate and debug paths
                self._validate_and_log_paths(source_path, remote_path)
                
                if self.stop_deployment:
                    self._append_deploy_output("\n[⚠️ STOPPED] Deployment cancelled by user during validation\n")
                    return
                
                exclude_patterns = self.config.get("local.tar_exclude", [])
                self._append_deploy_output(f"[INFO] Exclude patterns: {len(exclude_patterns)} rules\n")
                
                success, msg = DirectUploader.upload_project(
                    ssh,
                    str(source_path),
                    remote_path,
                    exclude_patterns,
                    progress_callback=self._append_deploy_output
                )
                
                if self.stop_deployment:
                    self._append_deploy_output("\n[⚠️ STOPPED] Deployment cancelled by user during upload\n")
                    return
                
                if not success:
                    raise Exception(f"Upload failed: {msg}")
                
                self._append_deploy_output(f"[OK] Files uploaded successfully\n")
                
                # Run remote management script
                self._append_deploy_output("\n[INFO] Building and restarting services...\n")
                
                if self.stop_deployment:
                    self._append_deploy_output("\n[⚠️ STOPPED] Deployment cancelled by user before build\n")
                    return
                
                remote_script = f"{self.remote_path_var.get()}/live-deployment/remote-manage.sh"
                returncode, stdout, stderr = ssh.run_deployment_script(
                    remote_script,
                    "all",
                    progress_callback=self._append_deploy_output
                )
                
                if self.stop_deployment:
                    self._append_deploy_output("\n[⚠️ STOPPED] Deployment cancelled by user after build\n")
                    return
                
                # Check for build errors in output
                build_failed = returncode != 0 or "error" in stderr.lower() or "failed" in stderr.lower()
                
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
                            f"{remote_path}/deploy-complete-fix.sh",
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
                self.current_ssh_session = None
                self.deployment_in_progress = False
                self.stop_deployment = False
                self._update_stop_button_state()
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
        self.stop_deployment = False
        self._update_stop_button_state()
        self._update_status("Applying complete asset fix...", 0)
        
        def execute():
            try:
                self.current_ssh_session = ssh
                
                self._append_deploy_output("\n[INFO] Applying complete asset serving fix...\n")
                
                if self.stop_deployment:
                    self._append_deploy_output("\n[⚠️ STOPPED] Operation cancelled by user\n")
                    return
                
                remote_script = f"{self.remote_path_var.get()}/deploy-complete-fix.sh"
                returncode, stdout, stderr = ssh.run_deployment_script(
                    remote_script,
                    "",
                    progress_callback=self._append_deploy_output
                )
                
                if self.stop_deployment:
                    self._append_deploy_output("\n[⚠️ STOPPED] Operation cancelled by user\n")
                    return
                
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
                self.current_ssh_session = None
                self.deployment_in_progress = False
                self.stop_deployment = False
                self._update_stop_button_state()
                self._update_status("Ready")
        
        thread = threading.Thread(target=execute, daemon=True)
        thread.start()

    def _deploy_restart(self) -> None:
        """Restart services only."""
        if not self.connected:
            messagebox.showerror("Not Connected", "Please connect to VPS first")
            return
        self._run_remote_command("restart", "Restarting services...")

    def _deploy_api_full(self) -> None:
        """Full API deployment: Build locally -> Upload -> Restart."""
        if not self.connected:
            messagebox.showerror("Not Connected", "Please connect to VPS first")
            return
        
        if not messagebox.askyesno("Confirm Full Deployment", "This will:\n1. Build API locally\n2. Upload files to VPS\n3. Restart PM2 service\n\nContinue?"):
            return
        
        self.deployment_in_progress = True
        self.stop_deployment = False
        self._update_stop_button_state()
        self._update_status("Starting full API deployment...", 0)
        
        def execute():
            try:
                project_root = self._get_project_root()
                
                # STEP 1: Build locally
                self._append_deploy_output("\n" + "="*60 + "\n")
                self._append_deploy_output("[STEP 1/3] Building API locally...\n")
                self._append_deploy_output("="*60 + "\n\n")
                
                if self.stop_deployment:
                    self._append_deploy_output("[STOPPED] Deployment cancelled\n")
                    return
                
                import subprocess
                import shutil
                
                api_source = project_root / "artifacts" / "api-server"
                if not api_source.exists():
                    raise Exception(f"API source not found: {api_source}")
                
                # Find pnpm
                pnpm_path = shutil.which("pnpm") or "pnpm"
                self._append_deploy_output(f"[INFO] Using pnpm: {pnpm_path}\n")
                self._append_deploy_output(f"[INFO] Building in: {api_source}\n")
                
                result = subprocess.run(
                    [pnpm_path, "run", "build"],
                    cwd=str(api_source),
                    capture_output=True,
                    text=True,
                    timeout=300
                )
                
                self._append_deploy_output(result.stdout)
                if result.stderr:
                    self._append_deploy_output(f"[STDERR] {result.stderr}\n")
                
                if result.returncode != 0:
                    raise Exception("Local build failed")
                
                self._append_deploy_output("[✓] Build successful\n\n")
                
                if self.stop_deployment:
                    self._append_deploy_output("[STOPPED] Deployment cancelled\n")
                    return
                
                # STEP 2: Upload files
                self._append_deploy_output("="*60 + "\n")
                self._append_deploy_output("[STEP 2/3] Uploading to VPS...\n")
                self._append_deploy_output("="*60 + "\n\n")
                
                if not self.ssh_manager:
                    raise Exception("SSH manager not initialized")
                
                self.current_ssh_session = self.ssh_manager
                
                dist_path = api_source / "dist"
                if not dist_path.exists():
                    raise Exception(f"Build output not found: {dist_path}")
                
                remote_path = self.remote_path_var.get()
                target_path = f"{remote_path}/artifacts/api-server/"
                
                self._append_deploy_output(f"[INFO] Uploading dist files...\n")
                self._append_deploy_output(f"[INFO] Source: {dist_path}\n")
                self._append_deploy_output(f"[INFO] Target: {target_path}\n\n")
                
                # Use SFTP to upload dist directory
                sftp = self.ssh_manager.client.open_sftp()
                
                # Upload all files from dist
                for item in dist_path.iterdir():
                    if self.stop_deployment:
                        self._append_deploy_output("[STOPPED] Upload cancelled\n")
                        sftp.close()
                        return
                    
                    remote_file = f"{target_path}{item.name}"
                    if item.is_file():
                        sftp.put(str(item), remote_file)
                        size_mb = item.stat().st_size / (1024*1024)
                        self._append_deploy_output(f"  [✓] Uploaded {item.name} ({size_mb:.2f} MB)\n")
                
                sftp.close()
                self._append_deploy_output("\n[✓] Upload complete\n\n")
                
                if self.stop_deployment:
                    self._append_deploy_output("[STOPPED] Deployment cancelled\n")
                    return
                
                # STEP 3: Restart PM2
                self._append_deploy_output("="*60 + "\n")
                self._append_deploy_output("[STEP 3/3] Restarting PM2 service...\n")
                self._append_deploy_output("="*60 + "\n\n")
                
                self._append_deploy_output("[INFO] Running: pm2 restart scootware-api\n")
                returncode, stdout, stderr = self.ssh_manager.execute_command(
                    "pm2 restart scootware-api"
                )
                
                self._append_deploy_output(stdout)
                if stderr:
                    self._append_deploy_output(f"[STDERR] {stderr}\n")
                
                if returncode != 0:
                    raise Exception(f"PM2 restart failed with code {returncode}")
                
                # Wait a moment for service to start
                import time
                time.sleep(2)
                
                # Verify service is running
                self._append_deploy_output("\n[INFO] Verifying service status...\n")
                returncode, stdout, stderr = self.ssh_manager.execute_command(
                    "pm2 status scootware-api"
                )
                
                if "online" in stdout.lower():
                    self._append_deploy_output("[✓] Service is ONLINE\n")
                else:
                    self._append_deploy_output(f"[Warning] Status unclear: {stdout}\n")
                
                # Final summary
                self._append_deploy_output("\n" + "="*60 + "\n")
                self._append_deploy_output("[✓] FULL DEPLOYMENT COMPLETE\n")
                self._append_deploy_output("="*60 + "\n")
                self._append_deploy_output("\nSteps completed:\n")
                self._append_deploy_output("  ✓ Built API locally\n")
                self._append_deploy_output("  ✓ Uploaded dist files to VPS\n")
                self._append_deploy_output("  ✓ Restarted PM2 service\n\n")
                
                self.error_logger.log_success("Full API deployment completed")
                self.root.after(0, lambda: messagebox.showinfo("Deployment Complete", "API deployment completed successfully!"))
                
            except Exception as e:
                error_msg = f"Deployment failed: {e}"
                self._append_deploy_output(f"\n[✗] ERROR: {error_msg}\n")
                self.error_logger.log_error(error_msg, e)
                self.root.after(0, lambda: messagebox.showerror("Deployment Failed", error_msg))
            
            finally:
                self.current_ssh_session = None
                self.deployment_in_progress = False
                self.stop_deployment = False
                self._update_stop_button_state()
                self._update_status("Ready")
        
        thread = threading.Thread(target=execute, daemon=True)
        thread.start()

    def _deploy_setup_vps(self) -> None:
        """Setup VPS (swap, etc.)."""
        if not self.connected:
            messagebox.showerror("Not Connected", "Please connect to VPS first")
            return
        
        if not messagebox.askyesno("Confirm", "Run VPS setup (this will create a 5GB swap file)?"):
            return

        def action():
            try:
                if not self.ssh_manager or not self.ssh_manager.client:
                    raise Exception("SSH manager not initialized or connected")

                self.current_ssh_session = self.ssh_manager

                if self.stop_deployment:
                    self._append_deploy_output("\n[⚠️ STOPPED] Setup cancelled by user\n")
                    return

                # Get the absolute project root (parent of deployment-manager directory)
                script_dir = self._get_project_root()
                self._append_deploy_output(f"[INFO] Detected project root: {script_dir}\n")
                
                # Upload only the live-deployment folder for setup
                source_dir = script_dir / "live-deployment"
                remote_dir = f"{self.remote_path_var.get()}/live-deployment"
                
                self._append_deploy_output(f"[INFO] Checking deployment scripts in {source_dir}...\n")
                
                if not source_dir.exists():
                    raise Exception(f"Source directory not found: {source_dir}")
                
                if self.stop_deployment:
                    self._append_deploy_output("\n[⚠️ STOPPED] Setup cancelled by user\n")
                    return
                
                sftp = self.ssh_manager.client.open_sftp()
                
                # Ensure remote directory exists
                try:
                    sftp.stat(remote_dir)
                except IOError:
                    self.ssh_manager._mkdir_recursive(sftp, remote_dir)

                files_to_upload = [f for f in source_dir.glob("*") if f.is_file()]
                if not files_to_upload:
                    raise Exception(f"No scripts found in {source_dir}")
                
                self._append_deploy_output(f"[INFO] Uploading {len(files_to_upload)} scripts to {remote_dir}...\n")
                    
                for item in files_to_upload:
                    if self.stop_deployment:
                        self._append_deploy_output("\n[⚠️ STOPPED] Setup cancelled by user during file upload\n")
                        sftp.close()
                        return
                    
                    remote_file = f"{remote_dir}/{item.name}"
                    sftp.put(str(item), remote_file)
                    self._append_deploy_output(f"  [OK] Uploaded {item.name}\n")
                sftp.close()

                if self.stop_deployment:
                    self._append_deploy_output("\n[⚠️ STOPPED] Setup cancelled by user\n")
                    return

                # Also upload package.json since it contains the build fix
                pkg_script = script_dir / "package.json"
                if pkg_script.exists():
                    self._append_deploy_output(f"[INFO] Uploading package.json from {pkg_script}...\n")
                    self.ssh_manager.upload_file(str(pkg_script), f"{self.remote_path_var.get()}/package.json")
                else:
                    self._append_deploy_output("[WARN] package.json not found in project root\n")

                self._run_remote_command("setup", "Setting up VPS environment...")
            except Exception as e:
                error_msg = f"Setup failed: {e}"
                self._append_deploy_output(f"\n[ERROR] {error_msg}\n")
                self.root.after(0, lambda: messagebox.showerror("Setup Failed", error_msg))
            finally:
                self.current_ssh_session = None
                self.deployment_in_progress = False
                self.stop_deployment = False
                self._update_stop_button_state()
                self._update_status("Ready")

        self.deployment_in_progress = True
        self.stop_deployment = False
        self._update_stop_button_state()
        self._update_status("Uploading scripts and setting up VPS...", 0)
        thread = threading.Thread(target=action, daemon=True)
        thread.start()



    def _run_remote_command(self, command: str, description: str) -> None:
        """Run a remote management command.
        
        Args:
            command: Command to run (update, build, restart)
            description: Description for output
        """
        self.deployment_in_progress = True
        self.stop_deployment = False
        self._update_stop_button_state()
        self._update_status(f"Executing {command}...", 0)
        
        def execute():
            try:
                ssh = SSHManager(
                    host=self.host_var.get(),
                    user=self.user_var.get(),
                    pem_key_path=self.key_var.get(),
                    port=self.config.get("vps.port", 22)
                )
                
                self.current_ssh_session = ssh
                
                if self.stop_deployment:
                    return
                
                success, msg = ssh.connect()
                if not success:
                    raise Exception(f"SSH connection failed: {msg}")
                
                self._append_deploy_output(f"▶ {description}\n")
                
                if self.stop_deployment:
                    self._append_deploy_output("\n[⚠️ STOPPED] Operation cancelled by user\n")
                    ssh.disconnect()
                    return
                
                remote_script = f"{self.remote_path_var.get()}/live-deployment/remote-manage.sh"
                returncode, stdout, stderr = ssh.run_deployment_script(
                    remote_script,
                    command,
                    progress_callback=self._append_deploy_output
                )
                
                if self.stop_deployment:
                    self._append_deploy_output("\n[⚠️ STOPPED] Operation cancelled by user\n")
                    ssh.disconnect()
                    return
                
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
                self.current_ssh_session = None
                self.deployment_in_progress = False
                self.stop_deployment = False
                self._update_stop_button_state()
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

    def _stop_current_operation(self) -> None:
        """Stop the current running deployment/upload operation."""
        if messagebox.askyesno("Confirm Stop", "Stop the current deployment/upload operation?\n\nThis will disconnect from the VPS and stop all running processes."):
            self.stop_deployment = True
            self._append_deploy_output("\n[⚠️ WARNING] Stop requested by user, disconnecting from VPS...\n")
            
            # Disconnect SSH sessions to interrupt current operations
            if self.current_ssh_session:
                try:
                    self.current_ssh_session.disconnect()
                except Exception:
                    pass
            
            if self.ssh_manager:
                try:
                    self.ssh_manager.disconnect()
                except Exception:
                    pass
            
            self._append_deploy_output("[✓] Disconnected from VPS. Stopping operation.\n")
            
            # Reset state
            self.deployment_in_progress = False
            self.stop_deployment = False
            self._update_stop_button_state()
            self._update_status("Operation stopped by user", 3000)

    def _update_stop_button_state(self) -> None:
        """Update stop button state based on deployment_in_progress."""
        if self.deployment_in_progress:
            self.stop_button.config(state=tk.NORMAL)
        else:
            self.stop_button.config(state=tk.DISABLED)
        self.root.update()

    def _start_services(self) -> None:
        """Start services (PM2 start/restart)."""
        if not self.connected:
            messagebox.showerror("Not Connected", "Please connect to VPS first")
            return
        
        self.deployment_in_progress = True
        self.stop_deployment = False
        self._update_stop_button_state()
        self._update_status("Starting services...", 0)
        
        def execute():
            try:
                ssh = SSHManager(
                    host=self.host_var.get(),
                    user=self.user_var.get(),
                    pem_key_path=self.key_var.get(),
                    port=self.config.get("vps.port", 22)
                )
                
                self.current_ssh_session = ssh
                
                if self.stop_deployment:
                    return
                
                success, msg = ssh.connect()
                if not success:
                    raise Exception(f"SSH connection failed: {msg}")
                
                self._append_deploy_output("▶ Starting services...\n")
                
                if self.stop_deployment:
                    self._append_deploy_output("\n[⚠️ STOPPED] Operation cancelled by user\n")
                    ssh.disconnect()
                    return
                
                # Start PM2 services
                cmd = "cd /home/admin/Scootware-Forum && pm2 start ecosystem.config.cjs --update-env && pm2 save"
                returncode, stdout, stderr = ssh.execute_command(cmd)
                
                self._append_deploy_output(stdout)
                if stderr:
                    self._append_deploy_output(f"[STDERR] {stderr}")
                
                if self.stop_deployment:
                    self._append_deploy_output("\n[⚠️ STOPPED] Operation cancelled by user\n")
                    ssh.disconnect()
                    return
                
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
                self.current_ssh_session = None
                self.deployment_in_progress = False
                self.stop_deployment = False
                self._update_stop_button_state()
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
            self.stop_deployment = False
            self._update_stop_button_state()
            self._update_status("Stopping services...", 0)
            
            def execute():
                try:
                    ssh = SSHManager(
                        host=self.host_var.get(),
                        user=self.user_var.get(),
                        pem_key_path=self.key_var.get(),
                        port=self.config.get("vps.port", 22)
                    )
                    
                    self.current_ssh_session = ssh
                    
                    if self.stop_deployment:
                        return
                    
                    success, msg = ssh.connect()
                    if not success:
                        raise Exception(f"SSH connection failed: {msg}")
                    
                    self._append_deploy_output("▶ Stopping all services...\n")
                    
                    if self.stop_deployment:
                        self._append_deploy_output("\n[⚠️ STOPPED] Operation cancelled by user\n")
                        ssh.disconnect()
                        return
                    
                    # Step 1: Stop PM2 services (more aggressive)
                    self._append_deploy_output("[1/4] Removing PM2 apps...\n")
                    returncode1, stdout1, stderr1 = ssh.execute_command("pm2 delete all 2>/dev/null || true")
                    self._append_deploy_output(stdout1)
                    
                    self._append_deploy_output("[2/4] Killing PM2 daemon...\n")
                    returncode2, stdout2, stderr2 = ssh.execute_command("pm2 kill 2>/dev/null || true")
                    self._append_deploy_output(stdout2)
                    
                    if self.stop_deployment:
                        self._append_deploy_output("\n[⚠️ STOPPED] Operation cancelled by user\n")
                        ssh.disconnect()
                        return
                    
                    # Step 2: Kill lingering Node.js processes
                    self._append_deploy_output("[3/4] Killing lingering Node.js processes...\n")
                    returncode3, stdout3, stderr3 = ssh.execute_command("pkill -f 'node|boot.mjs' 2>/dev/null || true")
                    if stdout3.strip():
                        self._append_deploy_output(stdout3)
                    self._append_deploy_output("[✓] Node processes terminated\n")
                    
                    if self.stop_deployment:
                        self._append_deploy_output("\n[⚠️ STOPPED] Operation cancelled by user\n")
                        ssh.disconnect()
                        return
                    
                    # Step 3: Stop Nginx (reverse proxy)
                    self._append_deploy_output("[4/4] Stopping Nginx reverse proxy...\n")
                    returncode4, stdout4, stderr4 = ssh.execute_command("sudo systemctl stop nginx 2>/dev/null || true")
                    if stdout4.strip():
                        self._append_deploy_output(stdout4)
                    self._append_deploy_output("[✓] Nginx stopped\n")
                    
                    # Verify all services are stopped
                    self._append_deploy_output("\n[Verification] Checking port 3000...\n")
                    returncode5, stdout5, stderr5 = ssh.execute_command("ss -ltnp 2>/dev/null | grep ':3000' || echo 'Port 3000 is free'")
                    self._append_deploy_output(stdout5)
                    
                    ssh.disconnect()
                    
                    # Consider it successful if we didn't encounter fatal errors
                    self._append_deploy_output("\n✓ All services stopped successfully!\n")
                    self._append_deploy_output("  - PM2 apps removed\n")
                    self._append_deploy_output("  - PM2 daemon killed\n")
                    self._append_deploy_output("  - Node processes terminated\n")
                    self._append_deploy_output("  - Nginx stopped\n")
                    self.error_logger.log_success("Services stopped")
                    self.root.after(0, lambda: messagebox.showinfo("Success", "All services stopped successfully!"))
                
                except Exception as e:
                    error_msg = f"Failed to stop services: {e}"
                    self._append_deploy_output(f"\n✗ {error_msg}\n")
                    self.error_logger.log_error(error_msg, e)
                    self.root.after(0, lambda: messagebox.showerror("Error", error_msg))
                
                finally:
                    self.current_ssh_session = None
                    self.deployment_in_progress = False
                    self.stop_deployment = False
                    self._update_stop_button_state()
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
