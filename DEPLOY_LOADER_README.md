# API Deployment Loader

Automated deployment script for Scootware Forum API that handles building, uploading, and restarting the service.

## Quick Start

```powershell
.\deploy-api-loader.ps1
```

## What It Does

The loader automates these 4 steps:

1. **Build** - Compiles TypeScript and bundles the API with `pnpm run build`
2. **Upload** - Transfers the `dist/` directory to AWS EC2 via SCP
3. **Restart** - Restarts the PM2 `scootware-api` service
4. **Verify** - Checks that the service is online

## Requirements

- PowerShell (Windows)
- `pnpm` installed and configured
- SSH key (`scootware.pem`) in the project root
- Access to AWS EC2 instance ([VPS_IP])
- PM2 running on the VPS

## Usage Options

### Standard Deployment (build + upload + restart)
```powershell
.\deploy-api-loader.ps1
```

### Skip Build (use existing dist files)
```powershell
.\deploy-api-loader.ps1 -SkipBuild
```

## Configuration

The script uses these hardcoded values (edit the script to change):

```powershell
$VPS_IP = "[VPS_IP]"
$VPS_USER = "admin"
$PEM_KEY = "scootware.pem"
$REMOTE_PATH = "/home/admin/Scootware-Forum"
$API_SOURCE = "artifacts/api-server"
$API_DIST = "artifacts/api-server/dist"
```

## Output Example

```
=========================================
  SCOOTWARE API DEPLOYMENT LOADER
=========================================

[1/4] Building API...
      Running: pnpm run build
      [OK] Build successful
        Bundle: dist/index.mjs (3.7 MB)

[2/4] Uploading to VPS ([VPS_IP])...
      [OK] Upload complete

[3/4] Restarting PM2 service...
      [OK] PM2 restarted

[4/4] Verifying service status...
      [OK] Service online

=========================================
  [OK] DEPLOYMENT COMPLETE
=========================================
```

## Troubleshooting

### "PEM key not found"
- Ensure `scootware.pem` exists in the project root

### "Build failed"
- Check that you're in the project root directory
- Verify `pnpm` is installed: `pnpm --version`
- Check for TypeScript errors: `cd artifacts/api-server && pnpm run build`

### "SCP upload failed"
- Verify SSH key permissions: `ls -la scootware.pem`
- Test SSH connection: `ssh -i scootware.pem admin@[VPS_IP]`
- Check network connectivity

### "PM2 restart failed"
- Verify the service exists: `pm2 list`
- Check PM2 logs: `pm2 logs scootware-api`

## Manual Steps (if needed)

```powershell
# 1. Build locally
cd artifacts/api-server
pnpm run build

# 2. Upload to VPS
scp -i scootware.pem -r dist admin@[VPS_IP]:/home/admin/Scootware-Forum/artifacts/api-server/

# 3. Restart on VPS
ssh -i scootware.pem admin@[VPS_IP] "pm2 restart scootware-api"

# 4. Check status
ssh -i scootware.pem admin@[VPS_IP] "pm2 status scootware-api"
```

## Next Steps After Deployment

1. Test the API health endpoint:
   ```
   http://[VPS_IP]:3000/api/health
   ```

2. View live logs:
   ```powershell
   ssh -i scootware.pem admin@[VPS_IP] "pm2 logs scootware-api"
   ```

3. Monitor service:
   ```powershell
   ssh -i scootware.pem admin@[VPS_IP] "pm2 status"
   ```

## Notes

- The loader runs from the **project root** directory
- It will automatically navigate to `artifacts/api-server` for the build
- All uploads use the `-r` flag for recursive directory transfer
- The PM2 restart is graceful (restarts running processes)
- Service verification happens automatically after restart
