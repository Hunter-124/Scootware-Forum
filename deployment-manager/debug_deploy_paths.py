"""Debug script to trace file paths through the upload process."""
import os
import sys
from pathlib import Path, PurePosixPath

# Fix encoding for Windows console
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

sys.path.insert(0, os.path.dirname(__file__))

from config import Config
from ssh_manager import DirectUploader

def analyze_paths(source_dir: str) -> None:
    """Analyze what files would be uploaded from a source directory."""
    
    config = Config()
    exclude_patterns = config.get("local.tar_exclude", [])
    source_path = Path(source_dir)
    remote_path = config.get("vps.remote_path")
    
    print("\n" + "="*80)
    print("DEPLOYMENT PATH ANALYSIS")
    print("="*80)
    print(f"\nSource Directory: {source_path.resolve()}")
    print(f"Remote Path:     {remote_path}")
    print(f"\nExclude Patterns ({len(exclude_patterns)}):")
    for pattern in exclude_patterns:
        print(f"  - {pattern}")
    
    # Scan files
    print("\n" + "-"*80)
    print("SCANNING FILES...")
    print("-"*80)
    
    files_to_upload = []
    excluded_files = []
    total_size = 0
    
    for root, dirs, files in os.walk(source_dir):
        # Check directory exclusions
        original_dirs = dirs[:]
        dirs[:] = [d for d in dirs if not DirectUploader._should_exclude(Path(root) / d, exclude_patterns, source_path)]
        excluded_dirs = set(original_dirs) - set(dirs)
        
        for excluded_dir in excluded_dirs:
            full_path = Path(root) / excluded_dir
            try:
                rel_path = full_path.relative_to(source_path)
                print(f"[EXCLUDE DIR] {rel_path}")
            except ValueError:
                pass
        
        # Check files
        for file in files:
            file_path = Path(root) / file
            if DirectUploader._should_exclude(file_path, exclude_patterns, source_path):
                try:
                    rel_path = file_path.relative_to(source_path)
                    excluded_files.append((rel_path.as_posix(), file_path.stat().st_size))
                except ValueError:
                    pass
            else:
                try:
                    rel_path = file_path.relative_to(source_path)
                    rel_path_posix = rel_path.as_posix()
                    
                    # Calculate remote location
                    remote_file = (PurePosixPath(remote_path) / PurePosixPath(rel_path_posix)).as_posix()
                    
                    file_size = file_path.stat().st_size
                    files_to_upload.append({
                        'local': rel_path_posix,
                        'remote': remote_file,
                        'size': file_size
                    })
                    total_size += file_size
                except ValueError:
                    pass
    
    # Report
    print(f"\n✓ Files to upload: {len(files_to_upload)}")
    print(f"  Total size: {total_size / (1024*1024):.2f} MB")
    
    print(f"\n✗ Files excluded: {len(excluded_files)}")
    if excluded_files:
        print(f"  Total excluded size: {sum(s for _, s in excluded_files) / (1024*1024):.2f} MB")
        print("\n  First 20 excluded files:")
        for rel_path, size in sorted(excluded_files)[:20]:
            print(f"    - {rel_path} ({size} bytes)")
    
    # Show critical files
    critical = [f for f in files_to_upload if DirectUploader._is_critical_file(f['local'])]
    print(f"\n★ Critical files (always upload): {len(critical)}")
    if critical:
        print("  First 10:")
        for f in critical[:10]:
            print(f"    {f['local']} -> {f['remote']}")
    
    # Show lib/db files
    lib_db = [f for f in files_to_upload if 'lib/db' in f['local']]
    print(f"\n📚 lib/db files: {len(lib_db)}")
    if lib_db:
        print("  First 10:")
        for f in lib_db[:10]:
            print(f"    {f['local']} -> {f['remote']}")
    
    # Show artifacts files
    artifacts = [f for f in files_to_upload if f['local'].startswith('artifacts/')]
    print(f"\n📦 artifacts/* files: {len(artifacts)}")
    if artifacts:
        print("  First 10:")
        for f in artifacts[:10]:
            print(f"    {f['local']} -> {f['remote']}")
    
    # Show root files
    root_files = [f for f in files_to_upload if '/' not in f['local']]
    print(f"\n📄 Root-level files: {len(root_files)}")
    if root_files:
        for f in root_files:
            print(f"  {f['local']} -> {f['remote']}")
    
    print("\n" + "="*80)


if __name__ == '__main__':
    # Test from project root
    source_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    analyze_paths(source_dir)
