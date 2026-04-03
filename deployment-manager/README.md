# Scootware Deployment Manager

A comprehensive Python GUI application for managing Scootware Forum deployment to VPS via SSH/SCP. Standardizes deployment workflow and provides health monitoring, error logging, and troubleshooting capabilities.

## Features

✅ **SSH/SCP Connection Management** - Secure connections using PEM keys
✅ **Full Deployment Automation** - Upload, build, and restart in one click
✅ **Incremental Updates** - Deploy only dependencies, build, or restart
✅ **Health Monitoring** - Check API status, server resources, database connectivity
✅ **Error Logging** - Comprehensive logging with clipboard export for support
✅ **Real-time Output** - Watch deployment progress live
✅ **Configuration Persistence** - Save connection settings locally
✅ **Extensible Design** - Built for interaction with future agents

## Installation

### Prerequisites

- Python 3.10+
- `scootware.pem` SSH key file in the project root or configured path
- Access to VPS at [VPS_IP]

### Setup

1. **Navigate to deployment manager directory:**
   ```bash
   cd deployment-manager
   ```

2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
   
   Or if using a virtual environment:
   ```bash
   python -m venv venv
   # Windows
   venv\Scripts\activate
   # macOS/Linux
   source venv/bin/activate
   
   pip install -r requirements.txt
   ```

3. **Run the application:**
   ```bash
   python gui.py
   ```
   
   Or:
   ```bash
   python -m __main__
   ```

## Quick Start

### 1. Configure Connection
- Go to **🔌 Connection** tab
- Set VPS Host (default: `[VPS_IP]`)
- Set SSH User (default: `admin`)
- Browse for PEM key file (`scootware.pem`)
- Set Remote Path (default: `/home/admin/Scootware-Forum`)
- Click **Test Connection** to verify
- Click **Save Configuration**

### 2. Deploy Project
- Go to **🚀 Deploy** tab
- Set Project Root (directory containing the Scootware repo)
- Choose deployment option:
  - **Full Deploy (All)** - Upload entire project, build, and restart (recommended for major updates)
  - **Update Dependencies** - Run pnpm install + migrations
  - **Build Only** - Rebuild frontend and backend
  - **Restart Services** - Restart PM2 processes without rebuilding

### 3. Monitor Health
- Go to **❤️ Health** tab
- Click **Check API Status** to test if backend is responding
- Click **Full Diagnostics** for comprehensive system check:
  - API response time
  - PM2 process status
  - Server memory/uptime
  - Database connectivity
  - Recent logs
- Click **Copy Diagnostics for Support** to share with developers
### 3.1) HTTPS/Cloudflare 521 recovery
- Ensure port 443 is opened and Nginx listens on it (CF 521 means origin is unreachable over HTTPS).
- From the VPS, run:
  ```bash
  sudo bash ./live-deployment/setup-https.sh
  ```
- If 521 remains, set Cloudflare SSL mode to `Flexible` or `DNS only` temporarily while certs are provisioned.
- After cert verification, switch back to `Full (strict)`.
### 4. Review Logs
- Go to **📝 Logs** tab to see all application events
- Click **Copy Logs** to save application logs
- Logs are auto-saved to `deployment.log` in the app directory

## Configuration

Configuration is stored in `~/.scootware_deploy.json` and includes:

- **VPS Connection**: Host, user, SSH port, PEM key path, remote path
- **Local Project**: Project root, tar exclusions (node_modules, .git, etc.)
- **API Health**: Health check URL, timeout
- **Logging**: Log file path, max log size

You can edit settings in:
- **Connection** tab for VPS settings
- **⚙️ Settings** tab for API and logging preferences

## Deployment Workflow

### Full Deployment (Recommended)
```
1. Create tarball of project (excludes node_modules, .git, .env.local, etc.)
2. Upload via SCP using SSH key
3. Extract on remote server
4. Run remote-manage.sh all
   ├─ pnpm install (dependencies)
   ├─ Migrations (database updates)
   ├─ pnpm run build (frontend & backend)
   └─ pm2 restart + nginx reload (services)
```

### Troubleshooting Workflow
```
1. Check API Status → See if service is responding
2. Full Diagnostics → Get comprehensive health report
3. Copy Diagnostics for Support → Share with developers
4. View Logs → See all operations and errors
```

## Error Handling

- **Connection Errors**: Check PEM key path, VPS IP, SSH credentials
- **Upload Failures**: Verify remote path exists and has write permissions
- **Build Failures**: 
  1. Check Full Diagnostics
  2. Click "Copy Logs" and review for specific errors
  3. Share diagnostics with developers for assistance
  
- **All errors are automatically logged** and can be copied to clipboard

## What Gets Excluded from Upload

By default, these are NOT uploaded during deployment:
- `node_modules/` - Dependencies (installed on server)
- `.git/` - Version control (use GitHub/GitLab)
- `.pglite-data/` - Local dev database
- `dist/` - Build artifacts (rebuilt on server)
- `.env.local` - Local development configs
- `pnpm-lock.yaml` - Regenerated on server

## Remote Management Scripts

The deployment manager uses existing scripts:

- **`live-deployment/remote-manage.sh`** - Server-side deployment orchestration
  - `update` - Install deps and run migrations
  - `build` - Build frontend and backend
  - `restart` - Restart PM2 and nginx
  - `all` - Run all above in sequence

## Advanced Features

### For Future AI Agent Integration

The app is designed to be extended:

1. **SSH Manager** - `ssh_manager.py` provides all SSH/SCP operations
2. **Health Monitor** - `health_monitor.py` tracks system status
3. **Error Logger** - `error_logger.py` captures all operations
4. **Config** - `config.py` manages persistent settings

Example usage:
```python
from ssh_manager import SSHManager
from health_monitor import HealthMonitor

# Connect to VPS
ssh = SSHManager("[VPS_IP]", "admin", "scootware.pem")
success, msg = ssh.connect()

# Check health
health = HealthMonitor("http://[VPS_IP]/api/health")
is_healthy, details = health.check_api_health()

# Execute remote command
code, stdout, stderr = ssh.execute_command("pm2 status")
```

## Security Notes

- **PEM Key**: Store securely. The app doesn't upload this to VPS.
- **Configuration File**: Stored in `~/.scootware_deploy.json` (user's home directory)
- **SSH**: Uses key-based authentication (no passwords in config)
- **Logs**: Stored locally, can be encrypted if needed

## Troubleshooting

### "PEM key not found"
- Check that the PEM key path is correct
- Verify file exists: `scootware.pem`
- Use **Browse** button to select file

### "Connection failed"
- Verify VPS IP: `[VPS_IP]`
- Check SSH user: `admin`
- Ensure PEM key has correct permissions: `chmod 600 scootware.pem`
- Test manually: `ssh -i scootware.pem admin@[VPS_IP]`

### "Deployment hangs"
- Check network connectivity
- Monitor PM2 logs: `pm2 logs scootware-api`
- Run Full Diagnostics to see status

### "Build fails"
- Run **Update Dependencies** first
- Check if migrations are needed
- Review build output in Deploy tab
- Copy logs and share with developers

## Support

For issues or troubleshooting:
1. Run **Full Diagnostics** (❤️ Health tab)
2. Click **Copy Diagnostics for Support**
3. Share the formatted output with development team

## File Structure

```
deployment-manager/
├── __main__.py              # Entry point
├── gui.py                   # Main GUI application
├── config.py                # Configuration management
├── error_logger.py          # Error logging and clipboard
├── ssh_manager.py           # SSH/SCP operations
├── health_monitor.py        # Health monitoring
├── requirements.txt         # Python dependencies
└── README.md               # This file
```

## Future Enhancements

- [ ] Scheduled deployment automation
- [ ] Multi-environment support (staging, production)
- [ ] Deployment history and rollback
- [ ] Automated backup before deployment
- [ ] Slack/Discord notifications
- [ ] Docker image support
- [ ] Load testing integration
- [ ] Certificate renewal automation

## License

Internal use only - Scootware Forum

## Version

v1.0.0 - Initial Release
