# Scootware Forum - Deployment Checklist

**Date:** March 30, 2026  
**Status:** Ready for VPS Deployment

## ✅ Pre-Deployment Verification

### Local Build Status
- ✅ Node.js v24.14.1 - VERIFIED
- ✅ pnpm v10.33.0 - VERIFIED
- ✅ Dependencies installed - VERIFIED
- ✅ TypeScript checks - PASSED
- ✅ Frontend build (vite) - SUCCESS
  - Artifacts: `artifacts/forum/dist/`
  - Bundle size: 672KB JS (gzip: 205KB)
  - CSS: 140KB (gzip: 21KB)
- ✅ Backend build (esbuild) - SUCCESS
  - Artifacts: `artifacts/api-server/dist/`
  - Main bundle: 3.7MB
  - All dependencies compiled

### Deployment Infrastructure
- ✅ VPS Host: [VPS_IP] (AWS)
- ✅ SSH Key: `scootware.pem` - AVAILABLE
- ✅ Python Environment: Configured (v3.14.3)
- ✅ Deployment Manager: Python dependencies installed
- ✅ Deployment GUI: RUNNING

## 🚀 Deployment Steps

### Step 0: Verify Environment Configuration (NEW!)
Before deploying, ensure the production environment is configured:

```bash
# Check development is still working
pnpm run check-env
# Should show: DATABASE_URL is commented out (correct!)

# Verify production config is ready
pnpm exec cross-env NODE_ENV=production node check-env.mjs
# Should show: DATABASE_URL points to VPS (correct!)
```

✅ **What to verify:**
- `.env.local` has `DATABASE_URL` commented out (for dev)
- `.env.production` has `DATABASE_URL=postgres://...@[VPS_IP]:5432/scootware`

### Step 1: Build for Production
```bash
pnpm run build:prod
# Builds with NODE_ENV=production
# Uses .env + .env.production configuration
# Creates production artifacts
```

### Step 2: Configure Connection (GUI)
1. Open **Deployment Manager GUI** (should already be running)
2. Go to **🔌 Connection** tab
3. Configure:
   - PEM Key Path: `c:\Users\nigga\Downloads\Scootware-Forum\Scootware-Forum\scootware.pem`
   - VPS Host: `[VPS_IP]`
   - SSH User: `admin`
   - Remote Path: `/home/admin/Scootware-Forum`
4. Click **Test Connection** (should show "Connected successfully")
5. Click **Save Configuration**

### Step 3: Deploy to VPS (GUI)
1. Go to **🚀 Deploy** tab in GUI
2. Set **Project Root**: `c:\Users\nigga\Downloads\Scootware-Forum\Scootware-Forum`
3. Click **Full Deploy (All)**
4. Monitor the deployment progress in the output panel
   - Should see: "Creating archive..."
   - Should see: "Uploading to VPS..."
   - Should see: "Building on server..."
   - Should see: "Restarting services..."
   - Deployment typically takes 3-5 minutes

### Step 4: Verify Deployment (GUI)
1. Once deployment completes, go to **❤️ Health** tab
2. Click **Full Diagnostics**
3. Verify:
   - ✅ API Status: Should respond with 200
   - ✅ PM2 Processes: Should show running services
   - ✅ Database Connectivity: Should show connected to VPS PostgreSQL
   - ✅ Memory/Uptime: Should show healthy metrics
   - ✅ Recent Logs: Should show no critical errors

## 📋 Key Files & Locations

**Local Project:**
- Web Root: `c:\Users\nigga\Downloads\Scootware-Forum\Scootware-Forum\artifacts\forum\dist\`
- API Server: `c:\Users\nigga\Downloads\Scootware-Forum\Scootware-Forum\artifacts\api-server\dist\`
- Database: Uses PGlite (in-memory) + PostgreSQL on VPS

**VPS Server:**
- Project Home: `/home/admin/Scootware-Forum`
- Frontend: `/home/admin/Scootware-Forum/artifacts/forum/dist`
- Backend: `/home/admin/Scootware-Forum/artifacts/api-server/dist`
- PM2 Config: `/home/admin/Scootware-Forum/ecosystem.config.cjs`

## 🔧 Troubleshooting

### Connection Issues
- Verify SSH key has proper permissions: `chmod 600 scootware.pem`
- Check VPS is accessible from your network (port 22)
- Verify admin user exists on VPS: `ssh -i scootware.pem admin@[VPS_IP]`

### Deployment Failures
- Check disk space on VPS: `df -h`
- Check Node.js version on VPS matches (v24+): `node --version`
- Review deployment logs in GUI **📝 Logs** tab
- Export diagnostic logs from **❤️ Health** tab for troubleshooting

### Service Issues After Deployment
- Check PM2 process status: `pm2 status`
- View service logs: `pm2 logs`
- Restart services: `pm2 restart all`
- Check API health: Visit `http://[VPS_IP]/api/health`

## 📞 Support Resources

- Deployment Manager README: `local-deployment/deployment-manager/README.md`
- Production Guide: `live-deployment/DEPLOYMENT_GUIDE_PROD.md`
- Architecture Docs: `.agents/skills/architecture/SKILL.md`
- Health Monitoring: Use the GUI's Health tab for real-time monitoring
- **NEW:** Environment Configuration: `ENV_CONFIGURATION.md` and `ENV_QUICK_REFERENCE.md`

## 🔐 Environment Configuration (New Feature!)

The project now uses a **modular environment system** to avoid configuration conflicts:

**Files:**
- `.env` - Shared defaults (committed to git)
- `.env.local` - Local dev (NOT in git, uses PGlite)
- `.env.production` - Production (NOT in git, uses VPS PostgreSQL)

**Key benefit:** No more manual editing of `.env` when switching between dev and production!

See [ENV_CONFIGURATION.md](ENV_CONFIGURATION.md) and [ENV_QUICK_REFERENCE.md](ENV_QUICK_REFERENCE.md) for full details.

---

**Next Action:** Open the Deployment Manager GUI and proceed with the steps above
