# QUICKSTART - Scootware Deployment Manager

## 1-Minute Setup

### Windows

1. **Open PowerShell** or Command Prompt
2. **Navigate to this directory:**
   ```
   cd deployment-manager
   ```
3. **Run the launcher:**
   ```
   run.bat
   ```
   This will automatically install Python dependencies and launch the GUI.

### macOS / Linux

1. **Open Terminal**
2. **Navigate to this directory:**
   ```
   cd deployment-manager
   ```
3. **Make the script executable and run it:**
   ```
   chmod +x run.sh
   ./run.sh
   ```

## 2-Minute Configuration

1. **Go to 🔌 Connection tab**
2. **Click "Browse"** next to PEM Key and select `scootware.pem`
3. **Click "Test Connection"** - should say "Connected successfully"
4. **Click "Save Configuration"** - settings are now saved

## 3-Minute First Deployment

1. **Go to 🚀 Deploy tab**
2. **Set Project Root** (browse to the Scootware-Forum directory)
3. **Click "Full Deploy (All)"**
4. **Watch the output** - it will:
   - Create a project archive
   - Upload to VPS ([VPS_IP])
   - Extract and build
   - Restart services
5. **Check ❤️ Health tab** when done to verify everything is running

## Troubleshooting

**"PEM key not found"**
- Make sure `scootware.pem` is in the same directory as this script
- Or use Browse button to select it

**"Connection failed"**
- Check your internet connection
- Verify VPS is online: `ping [VPS_IP]`
- Ensure you have SSH access set up

**"Deployment hangs"**
- Check network connectivity
- It might just be building (can take 1-2 minutes)

**Questions?**
- Check the full README.md for detailed documentation
- Run Full Diagnostics and copy the output for support

## Files You Need

- ✅ `scootware.pem` - SSH private key (should be in parent directory)
- ✅ `gui.py` - Main application
- ✅ `requirements.txt` - Python dependencies

That's it! The app will handle the rest.
