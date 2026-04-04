# Backend Deployment & Testing Guide

## Problem Summary

Two critical issues were reported and partially resolved:
1. ❌ **Login not working** - Session cookies not being persisted
2. ❌ **Password reset emails not sending** - SMTP not configured

## Root Causes Identified

### Issue 1: Admin.ts Syntax Error ✅ FIXED
- **Problem**: `export default router` was placed before route definitions, making routes unreachable
- **Fix Applied**: Moved export to end of file
- **Status**: Build now succeeds without errors

### Issue 2: Session Cookies Not Being Set (Configuration Fixed)
- **Problem**: Session middleware was configured with `secure: true` (requires HTTPS)
- **Context**: API runs on `localhost:3000` (HTTP) behind Nginx reverse proxy (HTTPS to HTTP)
- **Root Cause**: Browser won't set/send HTTP cookies when `secure: true` is configured
- **Fix Applied**: Set `secure: false` in session cookie config for proxy scenario
- **Configuration Now**: 
  ```javascript
  cookie: {
    secure: false,        // Allow HTTP cookies behind reverse proxy
    httpOnly: true,       // Prevent JavaScript access
    maxAge: 30 * 24 * 60 * 60 * 1000,  // 30 days
    sameSite: "lax",      // Safe cross-site defaults
  }
  ```

### Issue 3: Password Reset Emails Not Sending ⚠️ NEEDS CONFIGURATION
- **Problem**: SMTP environment variables are not set on VPS
- **Fix Required**: Add to `.env.production` on VPS:
  ```env
  SMTP_USER=your-email@example.com
  SMTP_PASS=your-app-password
  SMTP_HOST=smtp.gmail.com         # or your provider
  SMTP_PORT=587
  ```

## Deployment Steps

### Step 1: Build the API (Already Done ✅)
The API has been rebuilt with the fixes:
- Location: `artifacts/api-server/dist/`
- Size: 3.7MB bundle
- Build time: ~2.3 seconds

### Step 2: Deploy to VPS

**Using SSH:**
```bash
# Connect to VPS
ssh -i scootwareppk.ppk root@192.168.1.100

# Navigate to deployment directory
cd /home/app/scootware/api-server

# Backup current version
cp dist/index.mjs dist/index.mjs.backup

# Copy new bundle (run from local machine)
scp -i scootwareppk.ppk \
  artifacts/api-server/dist/index.mjs \
  root@192.168.1.100:/home/app/scootware/api-server/dist/index.mjs
```

### Step 3: Update SMTP Credentials on VPS

```bash
ssh -i scootwareppk.ppk root@192.168.1.100

# Edit environment file
nano /home/app/scootware/.env.production

# Add/update these variables:
SMTP_USER=your-email@example.com
SMTP_PASS=your-app-password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_FROM=noreply@yoursite.com

# Save and exit (Ctrl+X, Y, Enter)
```

### Step 4: Restart Service

```bash
ssh -i scootwareppk.ppk root@192.168.1.100

# Restart the API service
pm2 restart scootware-api

# Wait 5 seconds for startup
sleep 5

# Check status
pm2 status scootware-api

# View logs to confirm startup
pm2 logs scootware-api --lines 20
```

## Local Testing (Before Deploying)

### Option 1: Quick Local Test
```bash
cd artifacts/api-server
pnpm dev

# In another terminal
node ../../../test-login-locally.mjs
```

**Expected Output:**
```
✅ Set-Cookie header found:
   connect.sid=...
```

### Option 2: Manual Testing with curl

```bash
# Start API
cd artifacts/api-server && pnpm dev

# In another terminal, test login
curl -v -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "Test@123"
  }'
```

**Look for in response headers:**
```
< set-cookie: connect.sid=...; Path=/; HttpOnly; Max-Age=2592000; SameSite=Lax
```

If you see `Set-Cookie`, sessions are working! ✅

## Files Modified

1. **artifacts/api-server/src/app.ts**
   - Changed: Session cookie config (`secure: false`)
   - Changed: Added `trust proxy` setting

2. **artifacts/api-server/src/routes/admin.ts**
   - Changed: Moved `export default router` to end of file
   - Reason: Routes after export were unreachable

## Verification Checklist

After deploying to VPS, verify:

- [ ] API starts without errors: `pm2 logs scootware-api | grep -i error`
- [ ] Login endpoint accessible: `curl http://localhost:3000/api/auth/login`
- [ ] Session cookie sent: Check Set-Cookie header in login response
- [ ] User can login: Test with `testuser@example.com / Test@123`
- [ ] Session persists: Make request to `/api/auth/me` with session cookie
- [ ] Password reset email sends: Request password reset check email

## Still Not Working?

### If API crashes on startup:
```bash
pm2 logs scootware-api
# Look for database connection errors or syntax errors
# Check that .env.production has all required variables
```

### If session cookie still not set:
```bash
curl -v -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-Proto: https" \
  -H "X-Forwarded-Host: yoursite.com" \
  -d '{"email":"testuser@example.com","password":"Test@123"}'
```

Check response headers for `set-cookie`.

### If password reset email doesn't send:
1. Verify SMTP variables in `.env.production`
2. Check email logs: `pm2 logs scootware-api | grep -i email`
3. Test SMTP credentials manually:
   ```bash
   node -e "
     require('nodemailer').createTransport({
       host: process.env.SMTP_HOST,
       port: process.env.SMTP_PORT,
       auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
     }).verify(console.log)
   "
   ```

## Architecture Notes

**Session Flow:**
1. User sends credentials to `/api/auth/login`
2. Passport.js authenticates against database
3. `req.logIn()` serializes user and creates session
4. `req.session.save()` persists session to store
5. Express-session middleware sends `Set-Cookie` header
6. Browser stores cookie and sends it with future requests
7. Middleware deserializes session and attaches user to `req.user`

**Session Store Selection (automatic):**
- PostgreSQL available → Use PgSession (survives restarts)
- Only PGlite available → Use MemorySessionStore (resets on restart)
- Decision logic in `app.ts` lines 75-84

**Why `secure: false` is needed:**
- API runs on `http://localhost:3000`
- Nginx terminates HTTPS and proxies to localhost:3000
- Express-session with `secure: true` won't set cookies over HTTP
- `trust proxy: true` tells Express to read the original protocol from headers
- Sessions work because app can read `X-Forwarded-Proto: https` from Nginx

## Next Steps

1. **Immediate**: Deploy the new API bundle to VPS
2. **Configure**: Set SMTP credentials in `.env.production`
3. **Test**: Verify login works and sets session cookie
4. **Fix Database**: Set up persistent PostgreSQL database (currently using in-memory PGlite)
5. **Monitor**: Check logs for any remaining issues

---

**Build Date**: 2024
**API Version**: 0.0.0
**Status**: ✅ Ready for deployment
