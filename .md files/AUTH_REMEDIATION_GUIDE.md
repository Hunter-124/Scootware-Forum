# Scootware Forum - Authentication Remediation Guide

**Priority**: 🔴 CRITICAL  
**Est. Time to Fix**: 15-30 minutes  
**Complexity**: Medium

---

## What's Broken

1. Database migrations NOT run on VPS → tables don't exist
2. Session storage falls back to ephemeral in-memory database
3. User sessions lost after every server restart
4. SSO pending state not preserved between requests
5. Secrets exposed in version control

---

## Step-by-Step Remediation

### STEP 1: SSH into VPS and Check Current State

```bash
# SSH into your VPS
ssh admin@[VPS_IP]

# Go to project directory
cd /home/admin/Scootware-Forum

# Check if .env exists
ls -la .env .env.production
```

**Expected**: Should see `.env.production` exists

### STEP 2: Verify PostgreSQL is Running

```bash
# Check if Postgres is running
sudo systemctl status postgresql
# If not running: sudo systemctl start postgresql

# Test connection to database
psql postgresql://postgres:[POSTGRES_PASSWORD]@localhost:5432/scootware \
  -c "SELECT version();"

# If it fails, PostgreSQL isn't accessible on localhost:5432
```

**Expected Output** ✅:
```
PostgreSQL 14.x on x86_64-pc-linux-gnu, compiled by gcc (GCC) 9.4.0
```

**If Error** ❌:
- PostgreSQL not installed: `sudo apt install postgresql postgresql-contrib`
- Not running: `sudo systemctl start postgresql`
- Port wrong: Check `sudo netstat -tlnp | grep postgres`

### STEP 3: Run Database Migrations

This creates all required tables (`users`, `user_sessions`, `login_events`, etc.)

```bash
cd /home/admin/Scootware-Forum

# Install dependencies (if not already done)
pnpm install

# Run migrations
pnpm --filter @workspace/db run push
```

**Expected Output** ✅:
```
✓ 0000_slippery_chimera.sql
✓ 0001_crypto_payments.sql
✓ 0002_login_events.sql
✓ 0003_invites.sql
✓ 0004_password_reset.sql
✓ 0005_sso_fields.sql
✓ 0006_fix_upgrade_type_enum.sql
✓ 0007_subscription_posting.sql
Applied 8 migrations successfully
```

**Verify Tables Exist**:
```bash
psql postgresql://postgres:[POSTGRES_PASSWORD]@localhost:5432/scootware \
  -c "SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;"
```

**Expected Tables** ✅:
```
categories
crypto_payment_requests
invite_codes
invite_requests
login_events
posts
product_access
subforums
threads
users
```

### STEP 4: Rebuild and Restart Services

```bash
# Rebuild source
pnpm run build

# Restart PM2
pm2 restart all

# Restart nginx
sudo systemctl restart nginx

# Check status
pm2 list
```

**Expected** ✅:
```
id │ name              │ namespace   │ version │ mode    │ ↺
── │ api-server        │ default     │ 1.0.0   │ cluster │ 0
── │ forum             │ default     │ 1.0.0   │ cluster │ 0
```

### STEP 5: Test Login Flow

#### Via Command Line - Create Test User
```bash
# SSH into VPS
ssh admin@[VPS_IP]
cd /home/admin/Scootware-Forum

# Use this SQL to create a test user
psql postgresql://postgres:[POSTGRES_PASSWORD]@localhost:5432/scootware << EOF
INSERT INTO users (
  username, 
  email, 
  password_hash, 
  is_email_verified, 
  role, 
  created_at
) VALUES (
  'testuser',
  'test@scootware.us',
  '\$2b\$12\$dummyhashhere', -- This won't work, use next step
  true,
  'member',
  NOW()
);
EOF
```

#### Via Frontend - Test Live
1. Open `https://scootware.us/login`
2. Try login with test credentials (see Step 6)
3. Check for error messages in browser console

#### Via API - Direct Test
```bash
# From local machine
curl -X POST "https://scootware.us/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "testuser",
    "password": "testpass123"
  }' \
  -v  # verbose to see Set-Cookie header
```

**Expected** ✅:
```
HTTP/1.1 200 OK
Set-Cookie: connect.sid=...; HttpOnly; Secure; SameSite=none

{
  "user": {
    "id": 1,
    "username": "testuser",
    "email": "test@scootware.us",
    "isEmailVerified": true,
    ...
  }
}
```

**Expected** ❌ (if still broken):
```
HTTP/1.1 401 Unauthorized
{
  "error": "Invalid credentials"
}
```

### STEP 6: Create Test Accounts for Verification

Use the registration endpoint to create test accounts:

```bash
curl -X POST "https://scootware.us/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser2",
    "email": "test2@example.com",
    "password": "SecurePassword123"
  }'
```

**Check email verification requirement**:
```bash
# Query site config
curl "https://scootware.us/api/auth/site-config"

# Look for:
# "requireEmailVerification": true
```

If email verification is required but you won't receive emails, disable it:

```bash
psql postgresql://postgres:[POSTGRES_PASSWORD]@localhost:5432/scootware << EOF
UPDATE site_config 
SET value = 'false' 
WHERE key = 'requireEmailVerification';
EOF
```

### STEP 7: Test SSO Flows

#### Discord SSO
1. Open `https://scootware.us/login`
2. Click Discord button
3. Authenticate with Discord account
4. Should redirect to profile creation or home
5. **Check**: Session persists after browser refresh

#### Google SSO
1. Click Google button
2. Authenticate with Google
3. Should proceed smoothly
4. **Check**: Session persists

#### Steam SSO
1. Click Steam button
2. Authenticate with Steam (if not logged in, login first)
3. Should proceed
4. **Check**: Session persists

**Testing persistence** ✅:
```javascript
// In browser console:
fetch('/api/auth/me')
  .then(r => r.json())
  .then(console.log)

// Should return user object if logged in
// Should return 401 if not logged in
```

### STEP 8: Check Server Logs for Errors

```bash
# SSH to VPS
ssh admin@[VPS_IP]

# View PM2 logs for API server
pm2 logs api-server --lines 100

# Look for:
# ✅ "Connected to PostgreSQL via DATABASE_URL"
# ✅ No "Could not connect to DATABASE_URL" warnings
```

**Expected** ✅:
```
api-server: Connected to PostgreSQL via DATABASE_URL
api-server: Server listening on port 3001
```

**If Still Seeing** ❌:
```
api-server: Could not connect to DATABASE_URL Postgres, falling back to in-memory PGlite
```

Then your DATABASE_URL is still wrong or Postgres isn't running.

### STEP 9: Verify Session Persistence (Critical Test)

```bash
# Test that sessions survive restart
# 1. Login via browser
# 2. Open console and get the session:
fetch('/api/auth/me').then(r => r.json()).then(console.log)

# Should return user info
# 3. Restart PM2 on server:
ssh admin@[VPS_IP] "pm2 restart api-server"

# 4. Wait 10 seconds, refresh page
# 5. Run console command again

# Should STILL return user info (not 401)
```

**If user is logged out** ❌ after restart:
- Sessions are still in ephemeral PGlite
- Go back to STEP 2: Verify PostgreSQL connection is working

---

## Configuration Checklist

Before considering fixed, verify:

- [ ] PostgreSQL running and accessible at `localhost:5432`
- [ ] `user_sessions` table exists in database
- [ ] `users` table exists and has columns: `id`, `username`, `email`, `passwordHash`, etc.
- [ ] Regular login works (`POST /api/auth/login`)
- [ ] Session cookie set (`Set-Cookie: connect.sid=...`)
- [ ] Session persists after browser refresh
- [ ] Session persists after server restart
- [ ] Discord SSO redirects work
- [ ] Google SSO redirects work
- [ ] Steam SSO redirects work
- [ ] App logs show "Connected to PostgreSQL"
- [ ] App logs do NOT show "falling back to in-memory PGlite"

---

## Troubleshooting

### Issue: "relation 'users' does not exist"
**Cause**: Database migrations not run  
**Fix**: Execute STEP 3: `pnpm --filter @workspace/db run push`

### Issue: "Could not connect to DATABASE_URL Postgres"
**Cause**: PostgreSQL not running or connection URL wrong  
**Fix**:
```bash
# Check if running
sudo systemctl status postgresql

# Check connection:
psql postgresql://postgres:[POSTGRES_PASSWORD]@localhost:5432/scootware

# If fails, restart:
sudo systemctl restart postgresql
```

### Issue: User logs out after page refresh
**Cause**: Session not persisting in database  
**Fix**: 
```bash
# Check if still using PGlite:
pm2 logs api-server | grep -i "connected\|fallback"

# Should see: "Connected to PostgreSQL"
# NOT: "falling back to in-memory PGlite"
```

### Issue: SSO callback returns 404
**Cause**: Session data lost between redirect  
**Fix**: Same as above - ensure PostgreSQL is connected

### Issue: "SMTP: Could not send email"
**Cause**: Email credentials wrong or SMTP service down  
**Fix**:
```bash
# Test SMTP separately (not critical for login to work)
# For now, disable email verification requirement:
psql postgresql://... -c "UPDATE site_config SET value='false' WHERE key='requireEmailVerification';"
```

---

## Files Modified During Remediation

- `.env` or `.env.production` - DATABASE_URL should be correct
- `lib/db/drizzle/` - Migrations applied to database
- PM2 processes restarted
- No code changes needed

---

## Next Steps After This Works

1. **Rotate Exposed Secrets**:
   - Disable old Discord/Google/Steam apps
   - Create new ones
   - Update `.env.production` (not committed)

2. **Remove `.env` from Git**:
   ```bash
   git rm --cached .env
   echo ".env" >> .gitignore
   git add .gitignore
   git commit -m "Remove .env from tracking"
   ```

3. **Monitor Login Events**:
   ```sql
   SELECT * FROM login_events ORDER BY created_at DESC LIMIT 10;
   ```

4. **Set Up Automated Backups**:
   ```bash
   # Database backup
   pg_dump postgresql://... > backup.sql
   ```

---

## Success Indicators

✅ **Authentication is fixed when**:
1. POST /api/auth/login returns 200 with user object
2. Session cookie is set (Set-Cookie header)
3. GET /api/auth/me returns 200 with logged-in user
4. User stays logged in after page refresh
5. User stays logged in after server restart
6. SSO redirects complete successfully
7. App logs show "Connected to PostgreSQL"
8. No "falling back to in-memory PGlite" messages

---

## Time Breakdown

- STEP 1-2 SSH & Check: **2 minutes**
- STEP 3 Run Migrations: **3-5 minutes**
- STEP 4 Rebuild & Restart: **5-10 minutes**
- STEP 5-6 Testing: **5 minutes**
- STEP 7 SSO Testing: **5 minutes**
- STEP 8-9 Verification: **5 minutes**

**Total**: ~30 minutes for complete remediation + verification

---

## Emergency Fallback (If PostgreSQL Down)

If PostgreSQL becomes unavailable and you need immediate access:

```bash
# Temporarily allow logins without DB migration verification
# Edit lib/db/src/index.ts to log warnings but continue
# This is NOT recommended for production

# Better: Use backup PostgreSQL or RDS cluster
# Or spin up new VPS with fresh PostgreSQL install
```

---

**Generated**: April 2, 2026  
**For**: VPS Deployment at [VPS_IP]
