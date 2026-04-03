#!/usr/bin/env python3
"""Validate direct file upload logic - no deployment needed."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from ssh_manager import DirectUploader
from pathlib import Path

print("\n" + "="*70)
print("  DIRECT UPLOAD VALIDATION TEST")
print("="*70 + "\n")

# The project root is discovered relative to this script's location;
# climb up until we find package.json or reach filesystem root.
script_dir = Path(__file__).resolve().parent
project_root = script_dir
while project_root != project_root.parent and not (project_root / "package.json").exists():
    project_root = project_root.parent

if not (project_root / "package.json").exists():
    # fallback to immediate parent (best effort)
    project_root = script_dir.parent

print(f"Project Root: {project_root}")

# Exclude patterns
exclude_patterns = [
    "node_modules",
    ".git",
    ".pglite-data",
    "dist",
    "build",
    ".env.local",
    "pnpm-lock.yaml",
    ".next",
    "coverage",
    "uploads",
    "local-deployment",
    "live-deployment",
    "deployment-manager",
    "*.md",
    "*.markdown",
    "docs",
]

print(f"Exclude Patterns: {', '.join(exclude_patterns)}\n")

# Count files
print("Scanning files...")
files_to_upload = []
total_size = 0
excluded_count = 0
excluded_size = 0

for item in sorted(project_root.rglob("*")):
    if item.is_file():
        item_size = item.stat().st_size
        rel_path = item.relative_to(project_root)
        
        if not DirectUploader._should_exclude(item, exclude_patterns, project_root):
            files_to_upload.append((rel_path, item_size))
            total_size += item_size
        else:
            excluded_count += 1
            excluded_size += item_size

print(f"\nScan Results:")
print(f"  Files to upload: {len(files_to_upload)}")
print(f"  Upload size: {total_size / (1024*1024):.1f} MB")
print(f"  Files excluded: {excluded_count}")
print(f"  Excluded size: {excluded_size / (1024*1024):.1f} MB")
print(f"  Total project: {(total_size + excluded_size) / (1024*1024):.1f} MB")

reduction = (excluded_size / (total_size + excluded_size) * 100) if (total_size + excluded_size) > 0 else 0
print(f"  Reduction: {reduction:.1f}% smaller\n")

# Show sample files
print("Sample files to upload:")
for rel_path, size in sorted(files_to_upload)[:15]:
    print(f"  - {rel_path} ({size / 1024:.1f} KB)")

if len(files_to_upload) > 15:
    print(f"  ... and {len(files_to_upload) - 15} more files")

print("\nTop excluded directories:")
excluded_dirs = {}
for item in project_root.rglob("*"):
    if item.is_dir():
        for pattern in exclude_patterns:
            if pattern in item.parts:
                excluded_dirs[pattern] = excluded_dirs.get(pattern, 0) + 1
                break

for pattern, count in sorted(excluded_dirs.items(), key=lambda x: -x[1])[:5]:
    print(f"  - {pattern}: ~{count} items")

print("\n[OK] Validation complete - ready for direct upload deployment\n")
