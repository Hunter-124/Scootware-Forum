# Scootware Forum - GUI Deployment Manual

This guide explains how to use the streamlined Deployment Manager GUI for launching and managing the Scootware Forum website.

---

## Quick Start

### 1. Connect to VPS
1. Open the **Deployment Manager GUI** 
2. Go to the **🔌 Connection** tab
3. Enter:
   - **VPS Host**: `[VPS_IP]`
   - **SSH User**: `admin`
   - **PEM Key**: Browse to select `scootware.pem`
   - **Remote Path**: `/home/admin/Scootware-Forum`
4. Click **Connect**

### 2. Deploy Your Code
1. Go to the **🚀 Deploy** tab
2. Set **Project Root** to your local Scootware-Forum directory
3. Choose one of these workflows:

#### Option A: Quick Deploy (Recommended)
- Click **Upload Changed Files Only**
- Click **Build & Deploy**
- Monitors and reports when done

#### Option B: Fresh Start
- Click **Full Upload (Reset Cache)** (takes longer but forces full sync)
- Click **Build & Deploy**

---

## GUI Workflow Buttons

### 📦 Upload Files Section

#### "Upload Changed Files Only"
- **When to use**: After making code changes locally
- **What it does**: Only uploads files that have changed since last upload
- **Speed**: Fast (2-5 minutes for small changes)
- **Best for**: Iterative development and quick fixes

#### "Full Upload (Reset Cache)"
- **When to use**: When upload cache is corrupted or you need a clean sync
- **What it does**: Clears cache and uploads ALL files to VPS
- **Speed**: Slow (10-15 minutes)
- **Best for**: Fresh deployments or after clearing cache errors

### 🏗️ Build & Deploy Section

#### "Build & Deploy"
- **What it does** (automatically, on VPS):
  1. Applies database migrations and patches
  2. Builds the entire project (frontend + API)
  3. Restarts all services
  4. Configures Nginx
  5. Runs health checks
- **Speed**: 5-10 minutes
- **Result**: Website is live at `http://[VPS_IP]`
- **Database patches**: Automatically applied before build

### ⚡ Service Controls Section

#### "Start"
- Starts the application on the VPS
- Starts PM2 services and reloads Nginx
- Use if services are stopped

#### "Stop"
- Stops the application on the VPS
- Requires confirmation to prevent accidental shutdown
- Use for maintenance or troubleshooting

#### "Restart"
- Restarts the application on the VPS
- **Includes automatic database migrations and patches**
- Performs health checks after restart
- Use when you just want to restart without uploading

---

## Complete Deployment Workflow

### Scenario 1: Deploying After Local Code Changes

```
1. Make changes locally and test
2. In GUI 🔌 Connection tab: Click "Connect"
3. Go to 🚀 Deploy tab
4. Click "Upload Changed Files Only"
5. Click "Build & Deploy"
6. Watch output until ✅ (Green success message)
7. Wait 2-3 minutes for server to fully initialize
8. Visit http://[VPS_IP] to verify
```

**Total time**: ~5-10 minutes

### Scenario 2: Fresh Server Deployment (New Server)

```
1. SSH into VPS first to verify connection works
2. In GUI 🔌 Connection tab: Click "Connect"
3. Go to 🚀 Deploy tab
4. Click "Full Upload (Reset Cache)"
5. Wait for upload to complete
6. Click "Build & Deploy"
7. Watch output - service should report ✅
```

**Total time**: ~15-20 minutes

### Scenario 3: Restart Without Code Changes

```
1. In GUI 🔌 Connection tab: Click "Connect" (skip if already connected)
2. Go to 🚀 Deploy tab
3. Click "Restart"
4. Watch health checks
5. Service will restart with latest database patches
```

**Total time**: ~3-5 minutes

### Scenario 4: Troubleshooting - Service Won't Start

```
1. In GUI 🔌 Connection tab: Click "Connect"
2. Go to ❤️ Health tab
3. Click "Full Diagnostics"
4. Review output for error messages
5. Go to 🚀 Deploy tab
6. Click "Stop", then "Start"
7. Check health again
```

---

## Output Messages Explained

### ✅ Success Messages
```
✓ Build successful
✓ Services started successfully
✓ Database migrations applied
✓ Nginx is responding
```
**What to do**: Website is running, visit it to verify

### ⚠️ Warning Messages
```
⚠️  Database migration failed (continuing anyway - may retry on next startup)
⚠️  API health check failed (may still work through proxy)
```
**What to do**: Website may still work - visit and check. If it works, no action needed.

### ❌ Error Messages
```
❌ Build failed!
❌ Nginx deployment failed!
❌ ERROR: API failed to start!
```
**What to do**: 
1. Check full output for root cause
2. Click "Clear Output" and try again
3. If persists, use Full Diagnostics (❤️ Health tab)

---

## Understanding Database Migrations

Database migrations (patches) are applied automatically at two points:

1. **During Build & Deploy**: Runs before building
2. **During Restart**: Runs even if no code changes

This ensures your database schema is always in sync with your code.

**If a migration fails:**
- The application will continue running
- It will retry on the next restart
- View deploy output for specific error details

---

## Monitoring the Deployment

### During Deployment
- Watch the output scroll in real-time
- Look for ✓ (success) and ✗ (error) indicators
- Green success messages indicate completed steps

### After Deployment
1. Go to **❤️ Health** tab
2. Click **"Check API Status"**
3. Should show: `✓ Healthy - Status Code: 200`
4. Visit `http://[VPS_IP]` in browser to confirm website loads

### Viewing Logs
- Go to **📝 Logs** tab
- Logs show all deployment commands executed
- Useful for troubleshooting or record-keeping

---

## Common Tasks

### Task: Deploy a Bug Fix
```
1. Make code changes locally
2. Upload Changed Files Only
3. Build & Deploy
4. Verify at http://[VPS_IP]
```

### Task: Deploy After Database Schema Change
```
1. Make code + schema changes locally
2. Upload Changed Files Only
3. Build & Deploy
   (Migrations run automatically)
4. Verify at http://[VPS_IP]
```

### Task: Manually Restart Without Code Upload
```
1. Connect (if not connected)
2. Go to Deploy tab
3. Click "Restart"
4. Wait for ✅ success
```

### Task: Emergency Stop
```
1. Connect
2. Go to Deploy tab
3. Click "Stop"
4. Confirm in dialog
5. Application stops (website goes offline)
```

### Task: Restore Service After Stop
```
1. Connect
2. Go to Deploy tab
3. Click "Start"
4. Wait for ✅ success
5. Website comes back online
```

---

## Troubleshooting Guide

### Problem: "Build failed"
**Check**:
- Do you have pnpm installed locally?
- Are there TypeScript errors? (Check local build)
- Is your code valid?

**Fix**:
1. Run `pnpm run build` locally to check
2. Fix any errors
3. Try deployment again

### Problem: "API failed to start"
**Check**:
- Look at the deploy output for specific error
- Go to Health tab and run Full Diagnostics

**Fix**:
1. Click Stop, then Start
2. Wait 30 seconds
3. Check health status
4. If still failing, provide diagnostics to support team

### Problem: "Nginx not responding"
**Check**:
- Is Nginx process running?
- Is port 80 accessible?

**Fix**:
1. Click Stop, then Start
2. This resets Nginx configuration
3. Check health after restart

### Problem: Upload Hangs
**Fix**:
1. Close GUI
2. Delete `.deploy_cache.json` file in project root
3. Reopen GUI
4. Click "Full Upload (Reset Cache)"

---

## Advanced: Manual SSH Commands

If GUI is unavailable, you can SSH directly:

### Connect
```bash
ssh -i scootware.pem admin@[VPS_IP]
```

### Build & Deploy
```bash
cd /home/admin/Scootware-Forum
./live-deployment/remote-manage.sh build
./live-deployment/remote-manage.sh restart
```

### View Logs
```bash
pm2 logs scootware-api --lines 50 --nostream
```

### Check Status
```bash
pm2 status
sudo systemctl status nginx
```

---

## Settings Tab (⚙️)

### Configure Health Check URL
- Defaults to: `http://[VPS_IP]/api/health`
- Change if your IP address or domain changes

### Configure Logging
- Logs saved to: `deployment-manager/deployment.log`
- Useful for debugging deployment issues

---

## Support Info

If deployment fails:
1. Go to ❤️ Health tab
2. Click "Full Diagnostics"
3. Click "Copy Diagnostics for Support"
4. Share output with support team

This provides complete system state for debugging.

---

## Key Differences From Manual Deployment

| Task | Manual SSH | GUI |
|------|-----------|-----|
| Upload code | scp | GUI button (automatic) |
| Build | SSH command | GUI button (automatic) |
| Database migrations | Manual sql commands | Automatic in restart |
| Start services | pm2 start | GUI button |
| Stop services | pm2 stop | GUI button |
| Health checks | Manual curl | GUI button (automatic) |
| View logs | tail -f | GUI Health tab |

**Result**: GUI deployment is 3-5x faster and less error-prone.

---

## Command Reference

All available commands in Deploy tab:

```
Upload Section:
  - Upload Changed Files Only    → Smart upload only changed files
  - Full Upload (Reset Cache)    → Force full upload with cache reset

Build & Deploy:
  - Build & Deploy               → Upload, build, migrate, restart, health check

Service Controls:
  - Start     → Start services (PM2 + Nginx)
  - Stop      → Stop services
  - Restart   → Restart with automatic migrations and health checks
```

---

## Performance Tips

1. **Use "Upload Changed Files Only"**: Much faster than full uploads (2-5 min vs 10-15 min)
2. **Wait for health checks**: Some services take 10-15 seconds to fully initialize
3. **Build locally first**: Run `pnpm run build` locally before uploading to catch errors early
4. **Check database migrations**: If adding new tables, migrations run automatically during restart

---

## Next Steps After Deployment

After successful deployment:
1. ✅ Website is live at `http://[VPS_IP]`
2. ✅ API is responding to requests
3. ✅ Database is up to date with schema changes
4. ✅ Sessions and uploads are working

If you need to make more changes:
- Just make code changes locally
- Click "Upload Changed Files Only"
- Click "Build & Deploy"
- Changes go live in ~5 minutes

---

## Saving Configuration

After first setup, your connection settings are saved:
- VPS host and SSH credentials
- Project root path
- Remote path

**To reconfigure**:
- Go to 🔌 Connection tab
- Change settings
- Click "Save Configuration"

---

Generated: April 3, 2026
Version: Streamlined GUI v2 (Database Patches Auto-Applied)
