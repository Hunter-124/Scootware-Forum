# Scootware Forum - Login & SSO Authentication Analysis

**Date**: April 2, 2026  
**Status**: 🔴 CRITICAL ISSUES IDENTIFIED  
**Severity**: High - Authentication completely broken on VPS

---

## Executive Summary

Login and SSO are failing due to **cascading database connectivity issues**. When the VPS PostgreSQL connection fails, the app falls back to in-memory PGlite, making all authentication sessions ephemeral (lost on server restart). Additionally, database migrations have never been run on the VPS, so the required tables don't exist.

---

## 🔴 Critical Issues Found

### Issue 1: Database Connection Misconfiguration
**Severity**: 🔴 CRITICAL  
**Location**: `.env.production`  
**Root Cause**: PostgreSQL connection URL points to localhost instead of accessible VPS IP

```
Current (BROKEN):
DATABASE_URL="postgresql://postgres:[POSTGRES_PASSWORD]@127.0.0.1:5432/scootware"

Expected (if Postgres on VPS):
DATABASE_URL="postgresql://postgres:[POSTGRES_PASSWORD]@localhost:5432/scootware"
(or actual IP if on separate machine)
```

**Impact**:
- Connection fails → app falls back to in-memory PGlite
- Sessions stored in ephemeral database
- All login data lost on restart
- SSO pending state lost between requests

**Related Code**: [lib/db/src/index.ts](lib/db/src/index.ts#L26-L70)
```typescript
// When DATABASE_URL fails to connect:
pool = new Pool(...); // FAILS
// Falls back to:
const client = new PGlite(); // In-memory, ephemeral!
db = pgliteDrizzle(client, { schema }); // Temporary DB
```

---

### Issue 2: Missing Database Migrations on VPS
**Severity**: 🔴 CRITICAL  
**Location**: VPS `/home/admin/Scootware-Forum/`  
**Root Cause**: `pnpm --filter @workspace/db run push` never executed

**Missing Tables**:
- `users` - Cannot create accounts or verify credentials
- `user_sessions` - Cannot persist session data
- `login_events` - Cannot track login attempts
- `invite_codes`, `product_access`, `categories`, `posts`, `threads` - All forum data tables

**Impact**:
- Database handshake might connect but tables don't exist
- All queries fail with "table does not exist" errors
- No persistent user accounts
- SSO cannot store pending data

**Fix Required**:
```bash
# SSH into VPS
ssh admin@[VPS_IP]
cd /home/admin/Scootware-Forum

# Install and push migrations
pnpm install
pnpm --filter @workspace/db run push
```

---

### Issue 3: Session Persistence via Wrong Store
**Severity**: 🔴 CRITICAL  
**Location**: [artifacts/api-server/src/app.ts](artifacts/api-server/src/app.ts#L52-L70)  
**Root Cause**: Session store configured for PostgreSQL, but falls back to ephemeral PGlite

```typescript
// Line 52-58 in app.ts
app.use(
  session({
    store: new PgSession({
      pool,  // ← If pool is PGlite, sessions are ephemeral!
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    // ... cookie config
  })
);
```

**Current Behavior**:
1. User successfully logins → Session created
2. Session stored in `user_sessions` table
3. If table uses PGlite (in-memory) → Lost on restart
4. Even if persistent, session deserialization fails when:
   - `deserializeUser()` queries ephemeral DB
   - User object not found
   - User logged out

**Authentication Flow Broken**:
```
Login Request
    ↓ (SUCCESS)
Session Created & Stored
    ↓ (FAILS if PGlite)
Session deserialization on next request
    ↓
User data not found in DB
    ↓
401 Unauthorized - Not authenticated
```

---

### Issue 4: SameSite Cookie Policy in Production
**Severity**: 🟡 WARNING  
**Location**: [artifacts/api-server/src/app.ts](artifacts/api-server/src/app.ts#L65-L68)

```typescript
sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
```

**Dependency**: Requires `secure: true` when `sameSite: "none"`  
**Issue**: If `NODE_ENV` not set to exactly `"production"` on VPS:
- Cookie has `SameSite=lax` instead of `none`
- SSO redirects from external providers (Discord, Google, Steam) are blocked
- Browser drops cross-site cookies

**Verification Needed**: Check if `NODE_ENV=production` on VPS

---

### Issue 5: Email Verification Requirement
**Severity**: 🟡 WARNING  
**Location**: [artifacts/api-server/src/routes/auth.ts](artifacts/api-server/src/routes/auth.ts#L379-L386)

```typescript
// Even if login succeeds, this check blocks it:
if (requireEmailVerification && !user.isEmailVerified) {
  res.status(403).json({ 
    error: "Please verify your email address before logging in..." 
  });
}
```

**Issue**: After password reset, user account exists but `isEmailVerified = false`  
**Impact**: User sees "verify your email" error even with correct credentials  
**Resolution**: Either send verification email or disable requirement in site config

---

### Issue 6: Exposed Secrets in Version Control
**Severity**: 🟠 MEDIUM  
**Location**: `.env` (committed to repo)  
**Risk**: All OAuth/API secrets publicly accessible

**Exposed Credentials**:
- Discord Client Secret
- Google Client Secret
- Steam API Key
- Resend SMTP Password
- All crypto wallet addresses

**Immediate Action**:
1. Rotate all exposed credentials NOW
2. Add `.env` to `.gitignore`
3. Move to `.env.local` and `.env.production` (not committed)

---

## 📋 Authentication Implementation Details

### Login Endpoint Location
**File**: [artifacts/api-server/src/routes/auth.ts](artifacts/api-server/src/routes/auth.ts#L378-L420)  
**Path**: `POST /api/auth/login`  
**Method**: Express route with Passport Local strategy

```typescript
router.post("/login", async (req: Request, res: Response, next) => {
  // 1. Validate input (identifier or email + password)
  // 2. Use Passport LocalStrategy
  // 3. Query users table for email OR username
  // 4. bcrypt.compare(password, passwordHash)
  // 5. req.logIn(user) → serialize user ID to session
  // 6. Save session → store in user_sessions table
  // 7. Return user object
});
```

**Success Path** ✅ (if DB working):
```
POST /api/auth/login { identifier: "user@email.com", password: "..." }
  → Query: SELECT * FROM users WHERE email = 'user@email.com'
  → Hash check: bcrypt.compare()
  → Session created: INSERT INTO user_sessions (sid, sess, expire)
  → Cookie set: Set-Cookie: connect.sid=...
  → Response: 200 { user: { id, username, email, role, ... } }
```

**Broken Path** ❌ (current state on VPS):
```
POST /api/auth/login
  → Query fails: "user_sessions table does not exist"
  OR
  → Query succeeds but uses ephemeral PGlite
  → Session lost after restart
  → Next request: Session deserialization fails
  → User logged out → 401
```

---

### SSO (Discord/Google/Steam) Flow

**Location**: [artifacts/api-server/src/routes/auth.ts](artifacts/api-server/src/routes/auth.ts#L480-L750)

#### 1. OAuth Initiation
```
GET /api/auth/sso/{provider}
  → Passport.authenticate({scope: ["email", "profile"]})
  → Redirect to provider (Discord, Google, etc.)
```

#### 2. Provider Callback Processing  
```
GET /api/auth/sso/{provider}/callback
  → Provider returns auth code
  → Exchange code for user profile
  → Query DB: SELECT * FROM users WHERE discordId = '{profile.id}'
  
  IF user found:
    → req.logIn(user) → Session created
    → Redirect to home
  
  IF user NOT found (new SSO):
    → Store pending data in req.session.ssoPending
    → Redirect to /sso-link page
    → Frontend shows profile, asks for username
    
  IF setting ssoLinkMode:
    → Link to authenticated user's account
    → Update: googleId / discordId / steamId
```

**Critical Dependency**: Session storage must be persistent!
- `req.session.ssoPending` - Lost if in-memory
- Redirect chains fail - User sees "no pending SSO"

---

### Session Deserialization Issue

**Location**: [artifacts/api-server/src/routes/auth.ts](artifacts/api-server/src/routes/auth.ts#L37-L48)

```typescript
passport.serializeUser((user: any, done) => {
  done(null, user.id);  // Store only ID in session
});

passport.deserializeUser(async (id: number, done) => {
  // On EVERY request, fetch user from DB
  const [user] = await db.select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);
  done(null, user || null);
});
```

**Problem**: If `db` points to ephemeral PGlite:
- Session says user_id = 123
- deserializeUser queries PGlite for id=123
- Row not found (PGlite data lost after restart)
- User marked as unauthenticated
- Frontend sees 401 errors

---

### Password Reset Flow
**Location**: [artifacts/api-server/src/routes/auth.ts](artifacts/api-server/src/routes/auth.ts#L920-1050)

**Steps**:
1. `POST /api/auth/forgot-password` - Send email with reset token
2. User clicks link with token parameter
3. `GET /api/auth/verify-email?token=...` - Validate token
4. `POST /api/auth/reset-password` - Update password with new hash

**Dependency**: Password reset tokens stored in `users.passwordResetToken` column  
**Issue**: If table doesn't exist, operation fails silently

---

## 🔍 Environment Variable Status

### Required for Authentication
| Variable | Status | Configuration |
|----------|--------|---|
| SESSION_SECRET | ✅ | Set to 64-char hex |
| DATABASE_URL | ❌ BROKEN | Points to 127.0.0.1, should be localhost or VPS IP |
| SITE_URL | ✅ | https://scootware.us |
| NODE_ENV | ⚠️ Check | Should be "production" on VPS |

### Required for SSO
| Provider | Required Vars | Status |
|----------|---------------|--------|
| Discord | CLIENT_ID, CLIENT_SECRET, CALLBACK_URL | ✅ All present |
| Google | CLIENT_ID, CLIENT_SECRET, CALLBACK_URL | ✅ All present |
| Steam | API_KEY, REALM, CALLBACK_URL | ✅ All present |

### Required for Email
| Service | Variable | Status |
|---------|----------|--------|
| SMTP | SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS | ✅ All present |
| From | SMTP_FROM, SMTP_FROM_NAME | ✅ All present |

---

## 📊 Middleware & CORS Configuration

**File**: [artifacts/api-server/src/app.ts](artifacts/api-server/src/app.ts#L44-L50)

```typescript
app.use(cors({
  origin: true,        // Allow all origins (⚠️ insecure in production)
  credentials: true,   // Allow cookies in cross-origin requests
}));
```

**Issue**: `origin: true` means any domain can make authenticated requests  
**Recommendation**: Whitelist specific domains in production

---

## ✅ What IS Working (Correctly Implemented)

1. **Password Hashing**: bcrypt with 12 salt rounds ✅
2. **Token Generation**: 32-byte random tokens for reset/verification ✅
3. **Passport Setup**: Correctly configured for Local, Discord, Google, Steam ✅
4. **Email System**: SMTP configured (if secrets valid) ✅
5. **Session Middleware**: Correctly ordered before routes ✅
6. **Auth Route Organization**: Clean separation in `/routes/auth.ts` ✅
7. **Input Validation**: Zod schemas for all endpoints ✅
8. **Rate Limiting**: (Would need to check if implemented elsewhere) ⚠️

---

## 🚨 Required Fixes (Priority Order)

### BLOCKER #1 - Run Database Migrations
```bash
ssh admin@[VPS_IP]
cd /home/admin/Scootware-Forum
pnpm install
pnpm --filter @workspace/db run push
```

**Expected Output**: ✅ Migrations 0000-0007 applied successfully

### BLOCKER #2 - Verify PostgreSQL Connection
```bash
# On VPS:
psql postgresql://postgres:[POSTGRES_PASSWORD]@localhost:5432/scootware \
  -c "SELECT * FROM users LIMIT 1;"
```

**Expected**: No error, table exists (even if empty)

### BLOCKER #3 - Check NODE_ENV on VPS
```bash
# In PM2 process or .env check:
echo $NODE_ENV
```

**Expected**: `production`

### Fix #4 - Restarted Services
```bash
pm2 restart all
sudo systemctl restart nginx
```

### Fix #5 - Create Test Account
```bash
# From VPS terminal with .env loaded:
node -e "
const { db } = require('./artifacts/api-server/dist/index.mjs');
const bcrypt = require('bcrypt');
// Create local-admin account for testing
"
```

### Fix #6 - Rotate Exposed Secrets
- Generate new Discord, Google, Steam credentials
- Update `.env.production` (not committed)
- Remove `.env` from git history

---

## 🧪 Testing Checklist

After fixes, verify in this order:

- [ ] Migrations ran: `psql` commands succeed
- [ ] DB connection: App logs show "Connected to PostgreSQL"
- [ ] Regular login: Username + password works
- [ ] Email verification: Verification link works
- [ ] Password reset: Reset email received and works
- [ ] Discord SSO: Redirects to Discord, callback succeeds
- [ ] Google SSO: Redirects to Google, callback succeeds
- [ ] Steam SSO: Redirects to Steam, callback succeeds
- [ ] Session persistence: Login persists after refresh
- [ ] Session persistence: Login persists after server restart

---

## 📁 Key Files Reference

| File | Purpose |
|------|---------|
| [artifacts/api-server/src/routes/auth.ts](artifacts/api-server/src/routes/auth.ts) | Login, SSO, password reset endpoints |
| [artifacts/api-server/src/app.ts](artifacts/api-server/src/app.ts) | Session & Passport middleware setup |
| [lib/db/src/index.ts](lib/db/src/index.ts) | Database connection (PostgreSQL with PGlite fallback) |
| [artifacts/forum/src/pages/AuthPages.tsx](artifacts/forum/src/pages/AuthPages.tsx) | Frontend login form & auth UI |
| [lib/api-spec/openapi.yaml](lib/api-spec/openapi.yaml) | API contract (login endpoint definition) |
| `.env.production` | Database & API keys for VPS |
| `lib/db/drizzle/0000_slippery_chimera.sql` | First DB migration with users table |

---

## 🔗 Related Documentation

- [Architecture Skill](file:///c:\Users\nigga\Downloads\Scootware-Forum\Scootware-Forum\.agents\skills\architecture\SKILL.md) - Overall system design
- [QUICK_FIX_LOGIN.md](QUICK_FIX_LOGIN.md) - Previous attempt at fixing issue
- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Deployment procedures
- [ENV_CONFIGURATION.md](ENV_CONFIGURATION.md) - Environment setup guide

---

## Summary Table

| Area | Status | Issue | Fix |
|------|--------|-------|-----|
| **Database Connection** | ❌ | Uses 127.0.0.1 | Verify localhost:5432 works on VPS |
| **Migrations** | ❌ | Not run on VPS | `pnpm --filter @workspace/db run push` |
| **Sessions** | ❌ | Falls back to PGlite | Fix DB connection first |
| **Environment** | ⚠️ | NODE_ENV might not be "production" | Check and set explicitly |
| **Email Verification** | ⚠️ | Blocks new users | Disable or implement verify flow |
| **SSO Config** | ✅ | All env vars set | Should work once sessions fixed |
| **Exposed Secrets** | ❌ | In version control | Rotate and use non-committed `.env.production` |

---

**Generated**: April 2, 2026  
**Status**: Ready for remediation
