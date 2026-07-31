#!/usr/bin/env python3
import sys
from pathlib import Path

# Add local-deployment/deployment-manager to path
sys.path.insert(0, str(Path(__file__).parent / "local-deployment" / "deployment-manager"))

from config import Config

c = Config()
patterns = c.get("local.tar_exclude", [])
print(f"[CONFIG] Exclude patterns loaded: {len(patterns)}")
print(f"[PATTERNS] {patterns}")

# Resolve project root
root = Path(__file__).parent / "local-deployment" / "deployment-manager" / "../../"
root_resolved = root.resolve()
print(f"[ROOT] Relative: {root}")
print(f"[ROOT] Resolved: {root_resolved}")
print(f"[ROOT] Exists: {root_resolved.exists()}")
print(f"[ROOT] Is dir: {root_resolved.is_dir()}")

if root_resolved.exists():
    # Count files
    file_count = 0
    excluded_count = 0
    for f in root_resolved.rglob("*"):
        if f.is_file():
            file_count += 1
    print(f"[FILES] Total files in tree: {file_count}")
