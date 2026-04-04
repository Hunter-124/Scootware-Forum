# One-Click Deployment - Quick Reference

**Current Status:** ✅ Fixed and Tested (April 3, 2026)

## Quick Deploy

### GUI Method (Recommended)
```bash
cd deployment-manager
python -m tkinter gui.py
# Click "Full Deployment" button
```

### CLI Method
```bash
cd deployment-manager
python deploy.py
```

## What Gets Deployed

1. **Frontend** - React app with static assets
   - Location: `/home/admin/Scootware-Forum/artifacts/forum/dist/public`
   - Served via Nginx port 80

2. **Backend API** - Node.js Express server
   - Location: `/home/admin/Scootware-Forum/boot.mjs`
   - Runs via PM2 on port 3000

3. **Web Server** - Nginx reverse proxy
   - Listens on port 80 (HTTP) and 443 (HTTPS optional)
   - Proxies `/api/*` routes to port 3000
   - Serves static files with caching

4. **Database** - PostgreSQL (if configured)
   - Migrations run automatically during deployment

## Deployment Safety Features

✅ **Automatic port conflict resolution**
- Detects services using ports 80/443
- Forcefully terminates conflicting processes
- Verifies ports are free before starting

✅ **Health checks during and after deployment**
- Verifies API starts on port 3000
- Verifies Nginx can bind to ports 80/443
- Confirms frontend responds with HTML

✅ **Detailed error reporting**
- If deployment fails, shows exact SSH commands to debug
- Logs all decisions to `deployment.log`

✅ **Universal IP/Domain serving**
- Works with IP addresses ([VPS_IP])
- Works with domain names (scootware.us)
- No special config needed

## Typical Deployment Flow

```
1. [Local] Run deployment script
   └─ Connects to VPS via SSH
   
2. [Local] Uploads project files
   └─ 5-10 minutes, uses hashcache for speed
   
3. [VPS] Runs remote-manage.sh all
   ├─ [Step 1] Updates dependencies (pnpm install)
   ├─ [Step 2] Runs database migrations
   ├─ [Step 3] Builds production bundles
   ├─ [Step 4] Restarts PM2 services
   │   ├─ Kills old PM2 processes
   │   ├─ Starts API on port 3000
   │   ├─ Saves PM2 state
   │   └─ Verifies API is running
   ├─ [Step 5] Applies Nginx config
   │   ├─ Detects port conflicts
   │   ├─ Clears conflicting services
   │   ├─ Starts Nginx
   │   └─ Verifies frontend responds
   └─ [Done] Report success/failure
   
4. [Local] Verifies post-deployment
   ├─ Checks Nginx is running
   ├─ Checks ports 80/443 are listening
   └─ Confirms frontend HTML loads
```

## Troubleshooting

### "Frontend won't load"

```bash
# SSH to VPS
ssh -i scootware.pem admin@[VPS_IP]

# Check 1: Is Nginx running?
sudo systemctl status nginx

# Check 2: Are ports listening?
ss -tlnp | grep -E ':80|:443|:3000'

# Check 3: Can you reach frontend locally?
curl http://127.0.0.1/

# Check 4: Does API work?
curl http://127.0.0.1:3000/

# Check 5: Any port conflicts?
sudo fuser 80/tcp 443/tcp

# Fix: Clear conflicts and restart
sudo bash /home/admin/Scootware-Forum/live-deployment/apply-nginx-https.sh
```

### "API not responding"

```bash
# Check PM2 status
pm2 status

# Check API logs
pm2 logs scootware-api --lines 50

# Restart API
pm2 restart scootware-api

# Check if port 3000 is listening
ss -tlnp | grep 3000
```

### "Deployment hangs"

```bash
# Kill stuck processes
pm2 kill
sudo killall -9 node nginx

# Restart cleanly
sudo systemctl restart nginx
cd /home/admin/Scootware-Forum
pm2 start ecosystem.config.cjs
```

## Performance Tips

- ✅ Deployment uses hashcache - only uploads changed files
- ✅ First deployment: 5-10 minutes
- ✅ Subsequent deployments: 2-3 minutes (smaller uploads)
- ✅ To force full upload (clear cache):
  ```bash
  # In deployment manager GUI:
  # Deployment > Advanced > Clear Hashcache and Upload All
  
  # Or manually:
  rm .deploy_cache.json
  ```

## Monitoring After Deployment

```bash
# View real-time API logs
ssh -i scootware.pem admin@[VPS_IP] 'pm2 logs scootware-api'

# Check system resources
ssh -i scootware.pem admin@[VPS_IP] 'free -h && ps aux | grep node'

# Test API endpoints
curl http://[VPS_IP]/api/auth/me            # Should return 401 (not logged in)
curl http://[VPS_IP]/api/config             # Should return site config
curl http://[VPS_IP]/                       # Should return HTML (frontend)
```

## Important Notes

- 🔐 **Private Key**: Keep `scootware.pem` secure - it provides root access to VPS
- 📋 **Logs**: Check `deployment-manager/deployment.log` after each deployment
- ♻️ **Env Variables**: If you change `.env` files, deployment will pick them up
- 🚀 **Zero-downtime**: API stays up during deployment (old PM2 processes run until new ones start)

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Port 80 already in use" | `apply-nginx-https.sh` automatically handles this |
| "Frontend shows blank page" | Check browser console for JS errors; verify API responds |
| "API times out" | Check PM2 logs: `pm2 logs scootware-api` |
| "Database connection failed" | Set `DATABASE_URL` env var on VPS |
| "Deployment takes >15 min" | Kill stuck processes: `pm2 kill && sudo systemctl restart nginx` |

---

**Questions?** Check `/live-deployment/DEPLOYMENT_IMPROVEMENTS.md` for detailed technical info.

**Last Updated:** April 3, 2026  
**Status:** ✅ All improvements implemented and tested
