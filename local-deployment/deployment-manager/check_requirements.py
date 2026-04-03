"""Pre-flight checks before launching the deployment manager."""
import sys
import os
from pathlib import Path


def check_python_version():
    """Check if Python version meets minimum requirement."""
    if sys.version_info < (3, 10):
        print(f"❌ Python 3.10+ required, but you have {sys.version}")
        return False
    print(f"✓ Python version: {sys.version.split()[0]}")
    return True


def check_dependencies():
    """Check if required Python packages are installed."""
    required = ['paramiko', 'requests', 'pyperclip']
    missing = []
    
    for package in required:
        try:
            __import__(package)
            print(f"✓ {package} installed")
        except ImportError:
            missing.append(package)
            print(f"❌ {package} NOT installed")
    
    if missing:
        print(f"\nTo install missing packages, run:")
        print(f"  pip install {' '.join(missing)}")
        # Also try to install from requirements.txt
        req_file = Path(__file__).parent / "requirements.txt"
        if req_file.exists():
            print(f"\nOr install all at once:")
            print(f"  pip install -r requirements.txt")
        return False
    
    return True


def check_tkinter():
    """Check if tkinter is available."""
    try:
        import tkinter
        print(f"✓ tkinter available")
        return True
    except ImportError:
        print(f"❌ tkinter NOT installed")
        print(f"Install using:")
        print(f"  Ubuntu/Debian: sudo apt-get install python3-tk")
        print(f"  Fedora: sudo dnf install python3-tkinter")
        print(f"  macOS: brew install python-tk")
        return False


def check_pem_key():
    """Check if PEM key is accessible."""
    pem_paths = [
        Path.cwd() / "scootware.pem",
        Path.cwd().parent / "scootware.pem",
        Path.home() / ".ssh" / "scootware.pem",
    ]
    
    found = False
    for path in pem_paths:
        if path.exists():
            print(f"✓ PEM key found at: {path}")
            found = True
            break
    
    if not found:
        print(f"⚠  PEM key not found at:")
        for path in pem_paths:
            print(f"    {path}")
        print(f"   You can configure this in the Connection tab")
        return True  # Not critical, can be set in GUI
    
    return True


def check_vps_connectivity():
    """Check if VPS is reachable."""
    try:
        import socket
        sock = socket.create_connection(("[VPS_IP]", 22), timeout=5)
        sock.close()
        print(f"✓ VPS reachable at [VPS_IP]:22")
        return True
    except Exception as e:
        print(f"⚠  VPS not reachable: {e}")
        print(f"   This might be a network issue or VPS is offline")
        return True  # Not critical for testing the app


def main():
    """Run all pre-flight checks."""
    print("\n" + "="*50)
    print("  Scootware Deployment Manager - Pre-flight Check")
    print("="*50 + "\n")
    
    checks = [
        ("Python Version", check_python_version),
        ("Required Packages", check_dependencies),
        ("Tkinter", check_tkinter),
        ("PEM Key", check_pem_key),
        ("VPS Connectivity", check_vps_connectivity),
    ]
    
    results = []
    for name, check_func in checks:
        print(f"\n[{name}]")
        try:
            passed = check_func()
            results.append((name, passed))
        except Exception as e:
            print(f"❌ Error during check: {e}")
            results.append((name, False))
    
    # Summary
    print("\n" + "="*50)
    print("  Summary")
    print("="*50)
    
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)
    
    for name, passed in results:
        status = "✓" if passed else "❌"
        print(f"{status} {name}")
    
    print(f"\nResult: {passed_count}/{total_count} checks passed")
    
    # Critical checks
    critical = [
        results[0],  # Python version
        results[1],  # Dependencies
        results[2],  # Tkinter
    ]
    
    critical_passed = all(passed for _, passed in critical)
    
    print("\n" + "="*50)
    if critical_passed:
        print("✓ All critical requirements met!")
        print("You can now run the deployment manager:")
        print("  python gui.py")
    else:
        print("❌ Critical requirements not met.")
        print("Please install missing components and try again.")
    print("="*50 + "\n")
    
    return 0 if critical_passed else 1


if __name__ == "__main__":
    sys.exit(main())
