#!/usr/bin/env python3
import sys
import os
from pathlib import Path

# Add local-deployment/deployment-manager to path
sys.path.insert(0, str(Path(__file__).parent / "local-deployment" / "deployment-manager"))

from config import Config
from ssh_manager import DirectUploader

c = Config()
patterns = c.get("local.tar_exclude", [])
print(f"[CONFIG] Exclude patterns loaded: {len(patterns)}")
print(f"[PATTERNS] {patterns[:10]}... (showing first 10)")

# Resolve project root the way GUI does it
root_resolved = (Path(__file__).parent / "local-deployment" / "deployment-manager" / "../../").resolve()
print(f"\n[ROOT] Resolved: {root_resolved}")
print(f"[ROOT] Exists: {root_resolved.exists()}\n")

if root_resolved.exists():
    # Count files WITH exclusions (simulating what the uploader does)
    files_to_upload = []
    excluded_dirs = {}
    
    for root, dirs, files in os.walk(root_resolved):
        # Prune directories BEFORE walking (key optimization)
        original_len = len(dirs)
        dirs[:] = [d for d in dirs if not DirectUploader._should_exclude(Path(root) / d, patterns, root_resolved)]
        
        excluded_count = original_len - len(dirs)
        if excluded_count > 0:
            rel_dir = Path(root).relative_to(root_resolved)
            excluded_dirs[str(rel_dir)] = excluded_count
            
        for file in files:
            file_path = Path(root) / file
            if not DirectUploader._should_exclude(file_path, patterns, root_resolved):
                files_to_upload.append(file_path)
    
    total_size = sum(f.stat().st_size for f in files_to_upload)
    total_mb = total_size / (1024 * 1024)
    
    print(f"[RESULTS] Files to upload: {len(files_to_upload)}")
    print(f"[RESULTS] Total size: {total_mb:.1f} MB")
    print(f"\n[TOP EXCLUDED DIRS]")
    for dir_name, count in sorted(excluded_dirs.items(), key=lambda x: x[1], reverse=True)[:10]:
        print(f"  {dir_name}: {count} subdirs excluded")
