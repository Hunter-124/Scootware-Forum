#!/usr/bin/env python3
"""Test the improved tarball creation."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from ssh_manager import ArchiveUploader
from pathlib import Path
import time

print("\n" + "="*70)
print("  TARBALL CREATION TEST")
print("="*70 + "\n")

# The project root (one level up from deployment-manager)
project_root = Path.cwd().parent

print(f"Project Root: {project_root}")
print(f"Project Size: {sum(f.stat().st_size for f in project_root.rglob('*') ) / (1024*1024):.1f} MB (with node_modules)\n")

# Exclude patterns (avoid slow/large directories)
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
]

print(f"Exclude Patterns: {exclude_patterns}\n")
print("Creating tarball (this should be fast)...")
print("-" * 70)

start_time = time.time()

success, result = ArchiveUploader.create_tarball(
    str(project_root),
    exclude_patterns,
    output_path="./scoot-deploy-test.tar.gz"
)

elapsed = time.time() - start_time

print("-" * 70)

if success:
    tarball_size = Path(result).stat().st_size / (1024 * 1024)
    print(f"\n[SUCCESS] Tarball created in {elapsed:.1f} seconds")
    print(f"  Location: {result}")
    print(f"  Size: {tarball_size:.2f} MB")
    print(f"  Compression Ratio: {(project_root.stat().st_size if project_root.is_file() else 1) / (tarball_size or 1):.1f}x\n")
    
    # Verify contents
    import tarfile
    print("Checking tarball contents...")
    with tarfile.open(result, "r:gz") as tar:
        print(f"  Total files in archive: {len(tar.getnames())}")
        print(f"  Sample files:")
        for name in sorted(tar.getnames())[:10]:
            print(f"    - {name}")
        print(f"  ... and {len(tar.getnames()) - 10} more files")
    
    print("\n[OK] Tarball is valid and ready for upload")
    
else:
    print(f"\n[ERROR] {result}\n")
    sys.exit(1)
