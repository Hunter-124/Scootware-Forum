# Scootware Forum - Deployment Commands Reference

This document contains all commands needed to deploy and restart the Scootware Forum website on the production VPS ([VPS_IP]). Use these commands to build a comprehensive deployment script.

---

## Quick Start - One-Line Full Restart

```bash
ssh -i scootware.pem admin@[VPS_IP] "cd /home/admin/Scootware-Forum && pnpm --filter '@workspace/db' run push && pm2 restart scootware-api && sleep 3 && pm2 status"
```

---

## Prerequisites

- SSH key: `scootware.pem` (must be in your project root)
- VPS credentials: `admin@[VPS_IP]`
- Local project path: `c:\Users\nigga\Downloads\Scootware-Forum\Scootware-Forum`

---

## Section 1: Local Build (Before Deployment)

### 1.1 Install Dependencies
```bash
cd c:\Users\nigga\Downloads\Scootware-Forum\Scootware-Forum
pnpm install
```

### 1.2 Type Check
```bash
pnpm run typecheck
```

### 1.3 Build Frontend & API
```bash
pnpm run build:prod
```

**Expected output:**
- `artifacts/forum/dist/public/` - Frontend static files
- `artifacts/api-server/dist/index.mjs` - API bundle

---

## Section 2: Deploy to VPS

### 2.1 Transfer Frontend Build
```bash
scp -i scootware.pem -r artifacts/forum/dist/public/* admin@[VPS_IP]:/home/admin/Scootware-Forum/artifacts/forum/dist/public/
```

### 2.2 Transfer API Build
```bash
scp -i scootware.pem artifacts/api-server/dist/index.mjs admin@[VPS_IP]:/home/admin/Scootware-Forum/artifacts/api-server/dist/index.mjs
```

### 2.3 Transfer Configuration Files (if changed)
```bash
scp -i scootware.pem .env.production admin@[VPS_IP]:/home/admin/Scootware-Forum/.env
scp -i scootware.pem ecosystem.config.cjs admin@[VPS_IP]:/home/admin/Scootware-Forum/ecosystem.config.cjs
scp -i scootware.pem boot.mjs admin@[VPS_IP]:/home/admin/Scootware-Forum/boot.mjs
```

---

## Section 3: On VPS - Database & Migrations

### 3.1 Log into VPS
```bash
ssh -i scootware.pem admin@[VPS_IP]
```

### 3.2 Navigate to Project
```bash
cd /home/admin/Scootware-Forum
```

### 3.3 Run Database Migrations
```bash
pnpm --filter '@workspace/db' run push
```

**Expected output:**
```
✓ Pulling schema from database...
✓ Changes applied
```

---

## Section 4: On VPS - Start/Restart Services

### 4.1 Check Current PM2 Status
```bash
pm2 status
```

### 4.2 Restart API Service
```bash
pm2 restart scootware-api
```

**Wait 3-5 seconds for service to fully start**

### 4.3 Verify Service is Running
```bash
pm2 status
```

Expected output:
```
│ 0  │ scootware-api    │ default     │ 0.0.0   │ fork    │ XXXX     │ 0s     │ 1    │ online    │ 0%       │ 120mb    │ admin    │ disabled │
```

### 4.4 View Recent Logs
```bash
pm2 logs scootware-api --lines 20 --nostream
```

---

## Section 5: Verification

### 5.1 Check API Health (from VPS)
```bash
curl -s http://127.0.0.1:3000/api/health
```

**Expected response:**
```json
{"status":"ok"}
```

### 5.2 Check Frontend is Served (from VPS)
```bash
curl -s http://127.0.0.1:3000/ | head -5
```

**Expected response:**
```html
<html lang="en">
  <head>        
    <meta charset="UTF-8" />
```

### 5.3 Check via Public IP (from VPS)
```bash
curl -s http://[VPS_IP]/api/health
```

### 5.4 Check Nginx is Running
```bash
sudo systemctl status nginx
```

---

## Section 6: Complete Deployment Pipeline

### Full Fresh Deployment (from local machine):

```bash
# Step 1: Build locally
cd c:\Users\nigga\Downloads\Scootware-Forum\Scootware-Forum
pnpm install
pnpm run typecheck
pnpm run build:prod

# Step 2: Transfer files to VPS
scp -i scootware.pem -r artifacts/forum/dist/public/* admin@[VPS_IP]:/home/admin/Scootware-Forum/artifacts/forum/dist/public/
scp -i scootware.pem artifacts/api-server/dist/index.mjs admin@[VPS_IP]:/home/admin/Scootware-Forum/artifacts/api-server/dist/index.mjs

# Step 3: Run migrations and restart on VPS
ssh -i scootware.pem admin@[VPS_IP] "cd /home/admin/Scootware-Forum && pnpm --filter '@workspace/db' run push && pm2 restart scootware-api && sleep 3 && pm2 status"

# Step 4: Verify
ssh -i scootware.pem admin@[VPS_IP] "curl -s http://127.0.0.1:3000/api/health"
```

---

## Section 7: Troubleshooting

### 7.1 Service Won't Start
```bash
ssh -i scootware.pem admin@[VPS_IP] "pm2 logs scootware-api --lines 50"
```

### 7.2 Kill All PM2 Processes (Emergency)
```bash
ssh -i scootware.pem admin@[VPS_IP] "pm2 kill"
```

Then restart:
```bash
ssh -i scootware.pem admin@[VPS_IP] "cd /home/admin/Scootware-Forum && pm2 start ecosystem.config.cjs"
```

### 7.3 Check Nginx Configuration
```bash
ssh -i scootware.pem admin@[VPS_IP] "sudo nginx -t"
```

### 7.4 Restart Nginx
```bash
ssh -i scootware.pem admin@[VPS_IP] "sudo systemctl restart nginx"
```

### 7.5 Database Connection Issues
```bash
ssh -i scootware.pem admin@[VPS_IP] "cat /home/admin/Scootware-Forum/.env | grep DATABASE_URL"
```

---

## Section 8: Environment Variables (Production)

Key environment variables in `.env.production`:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://...your-db-credentials...
SESSION_SECRET=...generated-secret...
SITE_URL=https://scootware.us
FORUM_DIST_PATH=/home/admin/Scootware-Forum/artifacts/forum/dist/public
```

**Important:** Never commit `.env.production` to version control!

---

## Section 9: PM2 Configuration

The app is configured in `ecosystem.config.cjs`:

```javascript
{
  name: 'scootware-api',
  script: '/home/admin/Scootware-Forum/boot.mjs',
  cwd: '/home/admin/Scootware-Forum',
  env: {
    FORUM_DIST_PATH: '/home/admin/Scootware-Forum/artifacts/forum/dist/public',
    NODE_ENV: 'production',
    PORT: '3000'
  },
  node_args: '--enable-source-maps'
}
```

---

## Section 10: Quick Reference - Common Commands

| Task | Command |
|------|---------|
| Check status | `ssh -i scootware.pem admin@[VPS_IP] "pm2 status"` |
| View logs | `ssh -i scootware.pem admin@[VPS_IP] "pm2 logs scootware-api --lines 50 --nostream"` |
| Restart service | `ssh -i scootware.pem admin@[VPS_IP] "pm2 restart scootware-api"` |
| Stop service | `ssh -i scootware.pem admin@[VPS_IP] "pm2 stop scootware-api"` |
| Start service | `ssh -i scootware.pem admin@[VPS_IP] "pm2 start ecosystem.config.cjs"` |
| Test API | `ssh -i scootware.pem admin@[VPS_IP] "curl -s http://127.0.0.1:3000/api/health"` |
| Run migrations | `ssh -i scootware.pem admin@[VPS_IP] "cd /home/admin/Scootware-Forum && pnpm --filter '@workspace/db' run push"` |
| Check Nginx | `ssh -i scootware.pem admin@[VPS_IP] "sudo systemctl status nginx"` |

---

## Section 11: Deployment Checklist

- [ ] Local build completes without errors
- [ ] `artifacts/forum/dist/public/` exists with files
- [ ] `artifacts/api-server/dist/index.mjs` exists
- [ ] Files transferred to VPS successfully
- [ ] `pnpm --filter '@workspace/db' run push` completes successfully
- [ ] `pm2 restart scootware-api` completes
- [ ] `curl http://127.0.0.1:3000/api/health` returns `{"status":"ok"}`
- [ ] Frontend loads at `http://[VPS_IP]/`
- [ ] API is responding at `http://[VPS_IP]/api/health`
- [ ] No errors in `pm2 logs scootware-api`

---

## Notes

- The app runs on **port 3000** internally
- Nginx acts as reverse proxy on **ports 80/443**
- Database is PostgreSQL on the VPS
- Sessions are stored in PostgreSQL via connect-pg-simple
- Frontend is served as static files from the API (`FORUM_DIST_PATH`)
- All API code is bundled in `artifacts/api-server/dist/index.mjs`
- Boot sequence: `boot.mjs` → loads backend → serves frontend
