"""SSH and SCP operations for VPS deployment."""
import os
import time
import json
import hashlib
import concurrent.futures
import subprocess
import tempfile
from pathlib import Path, PurePosixPath
from typing import Optional, Callable, List, Tuple, Dict
import paramiko
from paramiko import SSHClient, AutoAddPolicy, RSAKey


class SSHManager:
    """Manages SSH/SCP connections to VPS."""

    def __init__(self, host: str, user: str, pem_key_path: str, port: int = 22):
        """Initialize SSH manager.
        
        Args:
            host: VPS hostname/IP
            user: SSH username
            pem_key_path: Path to PEM private key
            port: SSH port
        """
        self.host = host
        self.user = user
        # Resolve relative paths from current working directory
        pem_path = Path(pem_key_path)
        if not pem_path.is_absolute():
            # Try to find in common locations
            candidates = [
                pem_path,
                Path.cwd() / pem_path,
                Path.cwd().parent / pem_path,
                Path.home() / ".ssh" / pem_path,
            ]
            for candidate in candidates:
                if candidate.exists():
                    pem_path = candidate
                    break
        self.pem_key = str(pem_path)
        self.port = port
        self.client: Optional[SSHClient] = None
        self.sftp_client = None

    def connect(self) -> Tuple[bool, str]:
        """Connect to VPS via SSH.
        
        Returns:
            (success, message) tuple
        """
        try:
            # Verify PEM key exists
            if not Path(self.pem_key).exists():
                return False, f"PEM key not found: {self.pem_key}"
            
            # Create SSH client
            self.client = SSHClient()
            self.client.set_missing_host_key_policy(AutoAddPolicy())
            
            # Connect
            self.client.connect(
                self.host,
                username=self.user,
                key_filename=self.pem_key,
                port=self.port,
                timeout=10,
                look_for_keys=False,
                allow_agent=False
            )
            
            # Test SFTP
            self.sftp_client = self.client.open_sftp()
            self.sftp_client.close()
            self.sftp_client = None
            
            return True, "Connected successfully"
        
        except paramiko.AuthenticationException as e:
            return False, f"Authentication failed: {e}"
        except paramiko.SSHException as e:
            return False, f"SSH connection failed: {e}"
        except Exception as e:
            return False, f"Connection error: {e}"

    def disconnect(self) -> None:
        """Disconnect from VPS."""
        if self.sftp_client:
            try:
                self.sftp_client.close()
            except:
                pass
        
        if self.client:
            try:
                self.client.close()
            except:
                pass

    def execute_command(self, command: str) -> Tuple[int, str, str]:
        """Execute a command on VPS.
        
        Args:
            command: Shell command to execute
            
        Returns:
            (returncode, stdout, stderr) tuple
        """
        if not self.client:
            return 1, "", "Not connected to VPS"
        
        try:
            stdin, stdout, stderr = self.client.exec_command(command, timeout=300)
            
            # Wait for command completion
            returncode = stdout.channel.recv_exit_status()
            
            out_text = stdout.read().decode()
            err_text = stderr.read().decode()
            
            return returncode, out_text, err_text
        
        except Exception as e:
            return 1, "", str(e)

    def upload_file(self, local_path: str, remote_path: str) -> Tuple[bool, str]:
        """Upload a single file via SFTP.
        
        Args:
            local_path: Local file path
            remote_path: Remote file path
            
        Returns:
            (success, message) tuple
        """
        if not self.client:
            return False, "Not connected to VPS"
        
        try:
            sftp = self.client.open_sftp()
            
            # Ensure remote directory exists
            remote_dir = str(PurePosixPath(remote_path).parent)
            try:
                sftp.stat(remote_dir)
            except IOError:
                # Directory doesn't exist, create it
                self._mkdir_recursive(sftp, remote_dir)
            
            sftp.put(local_path, remote_path)
            sftp.close()
            
            return True, f"Uploaded {local_path}"
        
        except Exception as e:
            return False, f"Upload failed: {e}"

    def upload_file_with_progress(self, local_path: str, remote_path: str,
                                  progress_callback: Optional[Callable[[int, int], None]] = None) -> Tuple[bool, str]:
        """Upload a file with progress tracking.
        
        Args:
            local_path: Local file path
            remote_path: Remote file path
            progress_callback: Callback function(bytes_transferred, total_bytes)
            
        Returns:
            (success, message) tuple
        """
        if not self.client:
            return False, "Not connected to VPS"
        
        try:
            local_file = Path(local_path)
            total_size = local_file.stat().st_size
            
            sftp = self.client.open_sftp()
            
            # Ensure remote directory exists
            remote_dir = str(PurePosixPath(remote_path).parent)
            try:
                sftp.stat(remote_dir)
            except IOError:
                self._mkdir_recursive(sftp, remote_dir)
            
            # Custom callback for progress
            def callback(transferred, total):
                if progress_callback:
                    progress_callback(transferred, total)
            
            sftp.put(local_path, remote_path, callback=callback)
            sftp.close()
            
            return True, f"Uploaded {local_path}"
        
        except Exception as e:
            return False, f"Upload failed: {e}"

    def download_file(self, remote_path: str, local_path: str) -> Tuple[bool, str]:
        """Download a file via SFTP.
        
        Args:
            remote_path: Remote file path
            local_path: Local file path
            
        Returns:
            (success, message) tuple
        """
        if not self.client:
            return False, "Not connected to VPS"
        
        try:
            sftp = self.client.open_sftp()
            
            # Ensure local directory exists
            Path(local_path).parent.mkdir(parents=True, exist_ok=True)
            
            sftp.get(remote_path, local_path)
            sftp.close()
            
            return True, f"Downloaded {remote_path}"
        
        except Exception as e:
            return False, f"Download failed: {e}"

    def run_deployment_script(self, script_path: str, args: str = "", 
                              progress_callback: Optional[Callable[[str], None]] = None) -> Tuple[int, str, str]:
        """Run remote deployment script.
        
        Args:
            script_path: Path to script on VPS
            args: Script arguments
            progress_callback: Callback for output lines
            
        Returns:
            (returncode, stdout, stderr) tuple
        """
        command = f"bash {script_path} {args}"
        
        if not self.client:
            return 1, "", "Not connected to VPS"

        try:
            stdin, stdout, stderr = self.client.exec_command(command, timeout=1800)
            channel = stdout.channel

            out_text = []
            
            while not channel.exit_status_ready() or channel.recv_ready() or channel.recv_stderr_ready():
                if channel.recv_ready():
                    data = channel.recv(1024).decode('utf-8', errors='replace')
                    if data:
                        out_text.append(data)
                        if progress_callback:
                            progress_callback(data)
                
                if channel.recv_stderr_ready():
                    data = channel.recv_stderr(1024).decode('utf-8', errors='replace')
                    if data:
                        # Append stderr to output as well for visibility
                        out_text.append(data)
                        if progress_callback:
                            progress_callback(data)
                
                import time
                time.sleep(0.01) # Small sleep to prevent CPU spinning

            returncode = channel.recv_exit_status()
            return returncode, "".join(out_text), ""

        except Exception as e:
            return 1, "", str(e)

        except Exception as e:
            return 1, "", str(e)

    @staticmethod
    def _mkdir_recursive(sftp, path: str) -> None:
        """Recursively create directories via SFTP.
        
        Args:
            sftp: SFTP client
            path: Directory path to create
        """
        if path == '/':
            return
        
        try:
            sftp.stat(path)
        except IOError:
            # Use PurePosixPath to ensure forward slashes and correct parent resolution
            # even when running on Windows
            p = PurePosixPath(path)
            dir_path = str(p.parent)
            if dir_path != path and dir_path != '.':
                SSHManager._mkdir_recursive(sftp, dir_path)
            sftp.mkdir(path)


class HashCache:
    """Manages local storage of uploaded file hashes."""

    def __init__(self, cache_file: str):
        """Initialize hash cache.
        
        Args:
            cache_file: Path to JSON cache file
        """
        self.cache_file = Path(cache_file)
        self.hashes: Dict[str, str] = {}
        self.load()

    def load(self) -> None:
        """Load hashes from disk."""
        if self.cache_file.exists():
            try:
                # If file is empty, skip loading
                if self.cache_file.stat().st_size == 0:
                    self.hashes = {}
                    return
                with open(self.cache_file, 'r') as f:
                    self.hashes = json.load(f)
            except Exception:
                # Corrupted or invalid JSON, reset to empty state
                self.hashes = {}
        else:
            self.hashes = {}

    def save(self) -> None:
        """Save hashes to disk."""
        try:
            # Ensure directory exists
            self.cache_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.cache_file, 'w') as f:
                json.dump(self.hashes, f, indent=2)
        except Exception:
            pass

    def get(self, rel_path: str) -> Optional[str]:
        """Get cached hash for a file.
        
        Args:
            rel_path: Relative file path
            
        Returns:
            MD5 hash or None
        """
        return self.hashes.get(rel_path)

    def update(self, rel_path: str, file_hash: str) -> None:
        """Update cached hash for a file.
        
        Args:
            rel_path: Relative file path
            file_hash: MD5 hash string
        """
        self.hashes[rel_path] = file_hash


class DirectUploader:
    """Handles direct file upload without tarball for faster deployment."""
    
    # Critical files that should always be synced regardless of cache
    CRITICAL_FILES = {
        'ecosystem.config.cjs',
        'boot.mjs',
        '.env.production',
        'package.json',
        'pnpm-lock.yaml',
        'pnpm-workspace.yaml',
        'index.html',  # SPA entry point - must always be available
    }
    
    # Critical directories (patterns) - files in these should always sync
    CRITICAL_DIRS = {
        'lib',  # Backend source modules, including @workspace/db
        'artifacts/forum/dist',  # Frontend build output
        'artifacts/api-server/dist',  # Backend build output
    }

    @staticmethod
    def _is_critical_file(rel_path: str) -> bool:
        """Check if file is critical (should always be synced).
        
        Args:
            rel_path: Relative path from source root (posix format with /)
            
        Returns:
            True if file should always be synced
        """
        # Check filename
        file_name = Path(rel_path).name
        if file_name in DirectUploader.CRITICAL_FILES:
            return True
        
        # Check if in critical directory - use proper path separator matching
        rel_path_normalized = rel_path.replace('\\', '/')
        if rel_path_normalized.endswith('.ts') or rel_path_normalized.endswith('.tsx'):
            return True
            
        for critical_dir in DirectUploader.CRITICAL_DIRS:
            critical_dir_normalized = critical_dir.replace('\\', '/')
            # Check exact directory match or subdirectory (with /)
            if (rel_path_normalized == critical_dir_normalized or 
                rel_path_normalized.startswith(critical_dir_normalized + '/')):
                return True
        
        return False

    @staticmethod
    def _should_exclude(file_path: Path, exclude_patterns: List[str], source_path: Path) -> bool:
        """Check if file should be excluded based on patterns relative to project root only.
        
        Handles multiple pattern types:
        - Exact names: "node_modules", ".env"
        - Extensions: "*.log", "*.pem"
        - Subdirectories: Matches files/dirs at any level
        
        CRITICAL SAFEGUARD: Always exclude database directories to prevent data loss.
        
        Args:
            file_path: Full path to file/directory
            exclude_patterns: List of exclude patterns
            source_path: Project root path
            
        Returns:
            True if file should be excluded
        """
        try:
            rel_path = file_path.relative_to(source_path)
        except ValueError:
            return False

        rel_path_str = str(rel_path).replace('\\', '/')
        rel_name = file_path.name
        
        # CRITICAL SAFEGUARD: Always exclude database directories regardless of patterns
        # This prevents accidental overwriting of production databases when deploying
        # See: https://github.com/user/repo/issues/XXX (database wipe incident)
        db_dir_safeguards = {
            '.pglite-data', 'pglite-data',  # PGlite database directories
            'postgresql-data', 'mysql-data', 'mongo-data',  # Common DB dirs
            '.db-data', '.data'  # Generic data directories
        }
        if rel_name in db_dir_safeguards or any(part in db_dir_safeguards for part in rel_path.parts):
            return True
        
        for pattern in exclude_patterns:
            pattern = pattern.strip()
            if not pattern:
                continue
            
            # Handle wildcard patterns (e.g., "*.log", "*.pem")
            if pattern.startswith('*'):
                if rel_name.endswith(pattern[1:]):  # *.ext matches filename
                    return True
            
            # Handle everything else - exact match against any part of the path
            # This handles: directories, filenames, and specific files
            
            # Split path into parts for component matching
            path_parts = rel_path.parts
            
            # 1. Exact filename match (e.g., "scootware.pem")
            if rel_name == pattern:
                return True
            
            # 2. Exact top-level directory match (e.g., ".git" at root)
            if path_parts and path_parts[0] == pattern:
                return True
            
            # 3. Subdirectory match - matches if pattern is anywhere in the path
            #    This handles "deployment-manager" being excluded even in subdirs
            if pattern in path_parts:
                return True
            
            # 4. Full relative path match
            if rel_path_str == pattern:
                return True
            
            # 5. Path prefix match (for directory patterns like "uploads", "dist")
            # This ensures all contents of a directory are excluded
            if rel_path_str.startswith(pattern + '/') or rel_path_str.startswith(pattern + '\\'):
                return True
        
        return False

    @staticmethod
    def _get_local_stats(file_path: Path) -> str:
        """Get metadata identifier (size|mtime) for a local file.
        
        Args:
            file_path: Local file path
            
        Returns:
            Metadata string
        """
        stat = file_path.stat()
        # %T@ equivalent in python is stat.st_mtime as a float
        return f"{stat.st_size}|{stat.st_mtime}"

    @staticmethod
    def upload_project(ssh_manager: SSHManager, source_dir: str, remote_path: str,
                      exclude_patterns: List[str],
                      progress_callback: Optional[Callable[[str], None]] = None) -> Tuple[bool, str]:
        """Upload project files directly (no tarball) to remote server.
        
        Args:
            ssh_manager: Connected SSH manager
            source_dir: Local source directory
            remote_path: Remote extraction path
            exclude_patterns: List of patterns to exclude
            progress_callback: Progress callback
            
        Returns:
            (success, message) tuple
        """
        try:
            if progress_callback:
                progress_callback("[START] Beginning file upload...")
                progress_callback(f"[DEBUG] Exclude patterns count: {len(exclude_patterns)}")
                if exclude_patterns:
                    progress_callback(f"[DEBUG] Patterns: {', '.join(exclude_patterns[:5])}...")
                else:
                    progress_callback("[DEBUG] WARNING: No exclude patterns loaded!")
            
            source_path = Path(source_dir)
            if not source_path.is_dir():
                return False, f"Source directory not found: {source_dir}"
            
            # Get list of files to upload
            files_to_upload = []
            total_size = 0
            source_path = Path(source_dir)
            excluded_dirs = set()
            
            # Use os.walk with pruning for high-speed scanning
            for root, dirs, files in os.walk(source_dir):
                # Prune directories BEFORE os.walk descends into them
                original_dirs = dirs[:]
                dirs[:] = [d for d in dirs if not DirectUploader._should_exclude(Path(root) / d, exclude_patterns, source_path)]
                
                # Track which dirs were excluded
                for d in original_dirs:
                    if d not in dirs:
                        try:
                            excluded_dirs.add((Path(root) / d).relative_to(source_path).as_posix())
                        except:
                            pass
                
                for file in files:
                    file_path = Path(root) / file
                    if not DirectUploader._should_exclude(file_path, exclude_patterns, source_path):
                        files_to_upload.append(file_path)
                        total_size += file_path.stat().st_size
            
            # Log excluded directories
            if excluded_dirs and progress_callback:
                progress_callback(f"[DEBUG] Excluded {len(excluded_dirs)} directories")
                for d in sorted(list(excluded_dirs))[:10]:
                    progress_callback(f"       - {d}")
                if len(excluded_dirs) > 10:
                    progress_callback(f"       ... and {len(excluded_dirs)-10} more")
            
            if not files_to_upload:
                return False, "No files to upload"
            
            total_bytes = total_size / (1024 * 1024)
            if progress_callback:
                progress_callback(f"[SCAN] Found {len(files_to_upload)} files ({total_bytes:.1f} MB)")
            
            # Log lib/db files for verification
            lib_db_files = [f for f in files_to_upload if "lib/db" in str(f).replace("\\", "/")]
            if lib_db_files:
                if progress_callback:
                    progress_callback(f"[INFO] lib/db files to upload: {len(lib_db_files)}")
                    for f in lib_db_files[:10]:  # Show first 10
                        progress_callback(f"       - {f.relative_to(source_path)}")
            else:
                if progress_callback:
                    progress_callback("[WARNING] No lib/db files found in upload list!")
            
            # Use a local metadata cache for speed
            cache_file = source_path / ".deploy_cache.json"
            hash_cache = HashCache(str(cache_file))
            
            # Zero-Query Sync: Removed remote stats fetching for maximum speed.
            # We trust the local cache as the primary source of truth.
            
            # Gather local stats in parallel
            if progress_callback:
                progress_callback("[INFO] Analyzing local file metadata and checking cache...")
            
            local_stats_map = {}
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future_to_file = {executor.submit(DirectUploader._get_local_stats, f): f for f in files_to_upload}
                for i, future in enumerate(concurrent.futures.as_completed(future_to_file)):
                    f = future_to_file[future]
                    local_stats_map[f] = future.result()

            if progress_callback:
                progress_callback("[UPLOAD] Starting transfer...")
            
            # Connect SFTP
            if not ssh_manager.client:
                return False, "SSH not connected"
            
            sftp = ssh_manager.client.open_sftp()
            
            try:
                # Create base remote directory
                try:
                    sftp.stat(remote_path)
                except IOError:
                    SSHManager._mkdir_recursive(sftp, remote_path)
                
                # Upload files maintaining directory structure
                uploaded = 0
                skipped = 0
                lib_db_count = 0
                for local_file in files_to_upload:
                    rel_path = local_file.relative_to(source_path)
                    rel_path_posix = rel_path.as_posix()
                    
                    # Use metadata identifiers for comparison
                    local_stat = local_stats_map[local_file]
                    
                    # Check if this is a critical file or in a critical directory (always sync)
                    is_critical = DirectUploader._is_critical_file(rel_path_posix)
                    
                    # Special logging for lib/db files to debug upload issues
                    if "lib/db" in rel_path_posix:
                        lib_db_count += 1
                        if lib_db_count <= 10 and progress_callback:  # Log first 10
                            cached_stat = hash_cache.get(rel_path_posix)
                            progress_callback(f"       [lib/db] {rel_path_posix}: critical={is_critical}, will_upload={is_critical or cached_stat is None or cached_stat != local_stat}")
                    
                    # Logic: Skip only if local_stat matches local_cache AND not critical
                    # Critical files and dist builds are always uploaded to ensure deployment integrity
                    if not is_critical and hash_cache.get(rel_path_posix) == local_stat:
                        skipped += 1
                        
                        if skipped % 500 == 0 and progress_callback:
                            progress_callback(f"  [SYNC] {skipped} files already up to date (cached)...")
                        continue

                    # Ensure remote path uses forward slashes
                    remote_file = (PurePosixPath(remote_path) / PurePosixPath(rel_path_posix)).as_posix()
                    
                    # Create remote directory if needed
                    remote_dir = str(PurePosixPath(remote_file).parent)
                    try:
                        sftp.stat(remote_dir)
                    except IOError:
                        SSHManager._mkdir_recursive(sftp, remote_dir)
                    
                    # Upload file
                    try:
                        sftp.put(str(local_file), remote_file)
                        uploaded += 1
                        # Update local cache after successful upload
                        hash_cache.update(rel_path_posix, local_stat)
                        
                        # Log lib/db uploads
                        if "lib/db" in rel_path_posix and progress_callback:
                            progress_callback(f"       [lib/db] UPLOADED: {rel_path_posix}")
                        
                        if uploaded % 50 == 0 and progress_callback:
                            progress_callback(f"  [PROGRESS] {uploaded} files uploaded...")
                    except Exception as e:
                        # Log but continue on individual file failures
                        if progress_callback:
                            progress_callback(f"  [WARN] Failed to upload {rel_path}: {e}")
            finally:
                sftp.close()
                hash_cache.save()
            
            if progress_callback:
                msg = f"[OK] Successfully uploaded {uploaded} files"
                if skipped > 0:
                    msg += f" (skipped {skipped} unchanged files)"
                progress_callback(msg)
            
            return True, f"Uploaded {uploaded} files (skipped {skipped})"
        
        except Exception as e:
            return False, f"Upload failed: {str(e)}"


class ArchiveUploader:
    """Deprecated - kept for backward compatibility. Use DirectUploader instead."""

    @staticmethod
    def upload_and_extract(ssh_manager: SSHManager, tarball_path: str, remote_path: str,
                          progress_callback: Optional[Callable[[str], None]] = None) -> Tuple[bool, str]:
        """Upload tarball and extract on remote server.
        
        Args:
            ssh_manager: Connected SSH manager
            tarball_path: Local path to tarball
            remote_path: Remote extraction path
            progress_callback: Progress callback
            
        Returns:
            (success, message) tuple
        """
        try:
            if progress_callback:
                progress_callback("📦 Uploading tarball...")
            
            # Upload
            remote_tar = f"{remote_path}/project.tar.gz"
            success, msg = ssh_manager.upload_file(tarball_path, remote_tar)
            
            if not success:
                return False, f"Upload failed: {msg}"
            
            if progress_callback:
                progress_callback("📂 Extracting archive...")
            
            # Extract and cleanup
            cmd = f"cd {remote_path} && tar -xzf project.tar.gz && rm project.tar.gz"
            returncode, stdout, stderr = ssh_manager.execute_command(cmd)
            
            if returncode != 0:
                return False, f"Extraction failed: {stderr}"
            
            if progress_callback:
                progress_callback("✓ Archive extracted successfully")
            
            return True, "Archive uploaded and extracted"
        
        except Exception as e:
            return False, str(e)
