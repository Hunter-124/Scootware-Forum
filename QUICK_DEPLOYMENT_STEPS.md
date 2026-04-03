# Backend Fix - Quick Deployment Checklist

## Pre-Deployment (Local - Already Done ✅)

- [x] Fixed admin.ts export syntax error
- [x] Updated session cookie configuration  
- [x] Rebuilt API bundle successfully
- [x] Bundle verified: 3.7MB at dist/index.mjs
- [x] No TypeScript errors
- [x] All changes documented

## Deployment Steps (To Execute)

### 1. Transfer API Bundle to VPS
```bash
scp -i scootwareppk.ppk \
  artifacts/api-server/dist/index.mjs \
  root@192.168.1.100:/home/app/scootware/api-server/dist/index.mjs
```
- [ ] File transferred

### 2. Configure SMTP (Optional but Recommended)
```bash
ssh -i scootwareppk.ppk root@192.168.1.100
nano /home/app/scootware/.env.production
```
Add:
```
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```
- [ ] Credentials added

### 3. Restart API Service
```bash
ssh -i scootwareppk.ppk root@192.168.1.100
pm2 restart scootware-api
sleep 5
pm2 logs scootware-api --lines 5
```
- [ ] Service restarted
- [ ] No error messages in logs

## Verification Tests

### Test Login
```bash
curl -v -X POST https://yoursite.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"Test@123"}'
```
✅ Look for: `set-cookie: connect.sid=...` in response headers

### Test Session Persistence
```bash
curl https://yoursite.com/api/auth/me \
  -H "Cookie: connect.sid=YOUR_SAVED_COOKIE"
```
✅ Should return user data (not 401)

## What Was Fixed

| Issue | Status | File |
|-------|--------|------|
| Admin routes unreachable | ✅ FIXED | `admin.ts` - export moved to end |
| Session cookies not set | ✅ FIXED | `app.ts` - `secure: false` |
| Email not configured | ⚠️ NEEDS CONFIG | `.env.production` - add SMTP vars |

## If Something Goes Wrong

```bash
ssh -i scootwareppk.ppk root@192.168.1.100
pm2 logs scootware-api --lines 50  # See detailed errors
pm2 status scootware-api            # Check service status
pm2 restart scootware-api           # Force restart
```

**Status**: ✅ **READY FOR DEPLOYMENT** 🚀
