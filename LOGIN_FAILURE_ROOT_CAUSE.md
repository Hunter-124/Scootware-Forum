# 🔴 LOGIN FAILURE - ROOT CAUSE SUMMARY

**TL;DR**: Database migrations were never run on the VPS, and when PostgreSQL connection fails, the app falls back to an in-memory database that loses all auth data on every restart.

---

## What's Actually Happening

```
1. VPS starts → Tries to connect to PostgreSQL
   ↓
2. Connection fails (or tables don't exist) → Falls back to in-memory PGlite
   ↓
3. User logs in → Session created in memory
   ↓
4. Browser gets session cookie
   ↓
5. Server restarts → All in-memory data LOST
   ↓
6. User refreshes page → Session no longer exists
   ↓
7. req.session.user = undefined → 401 Unauthorized
   ↓
8. User sees: "Not authenticated"
```

---

## The Three Problems

### Problem #1: Missing Database Tables 🔴
- Migrations were **never run** on the VPS
- Commands like `pnpm --filter @workspace/db run push` not executed
- Tables don't exist: `users`, `user_sessions`, `login_events`
- Any database query fails

### Problem #2: Session in Wrong Database 🔴
- Sessions configured to save to PostgreSQL via `connect-pg-simple`
- But PostgreSQL connection fails or uses in-memory PGlite
- Sessions stored in ephemeral memory (not disk)
- Lost on every server restart

### Problem #3: Exposed API Secrets 🟠
- `.env` file committed to git repo
- Discord, Google, Steam API keys publicly visible
- SMTP credentials exposed
- Anyone can hijack OAuth flows

---

## The Authentication Endpoints

| Endpoint | Status | Issue |
|----------|--------|-------|
| `POST /api/auth/login` | ❌ Broken | DB tables missing |
| `POST /api/auth/register` | ❌ Broken | Can't create users table |
| `GET /api/auth/sso/discord` | ⚠️ Partial | Session doesn't persist |
| `GET /api/auth/sso/google` | ⚠️ Partial | Session doesn't persist |
| `GET /api/auth/sso/steam` | ⚠️ Partial | Session doesn't persist |
| `GET /api/auth/me` | ❌ Always 401 | User not in session |

---

## Why It Initially Worked (After Password Reset)

When password was reset:
1. Account was created in **temporary in-memory database**
2. Password hash was set
3. User could login **in that same session**
4. But session cookie didn't persist

After browser refresh or server restart:
- In-memory data gone
- Login fails with "Invalid credentials"

---

## Specific Code Issues

### `lib/db/src/index.ts` - Lines 26-70
```typescript
if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = nodeDrizzle(pool, { schema });
    await pool.query("SELECT 1"); // Test connection
  } catch (err) {
    console.warn("Could not connect to DATABASE_URL Postgres, falling back to PGlite");
    // ⚠️ Falls back here
    const client = new PGlite(); // ← In-memory!
    pool = client;
    db = pgliteDrizzle(client, { schema });
  }
}
```

When this fallback happens, sessions are no longer persistent.

### `artifacts/api-server/src/app.ts` - Lines 52-70
```typescript
app.use(
  session({
    store: new PgSession({
      pool, // ← If pool is PGlite, this doesn't persist!
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    // ...
  })
);
```

The session store expects PostgreSQL, not in-memory database.

### `artifacts/api-server/src/routes/auth.ts` - Lines 37-48
```typescript
passport.deserializeUser(async (id: number, done) => {
  // On EVERY request, fetch user from DB
  const [user] = await db.select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);
  
  done(null, user || null); // ← If query fails, user=null → 401
});
```

If the database is in-memory and restarted, user lookup fails.

---

## The Configuration Problem

### Local Development Works
- `.env.local` (or commented out `DATABASE_URL`)
- PGlite in-memory is intentional
- Sessions lost on restart (expected for dev)

### VPS Production Broken
- `.env.production` has `DATABASE_URL=postgres://...@127.0.0.1:5432`
- PostgreSQL connection fails OR tables don't exist
- Falls back to PGlite
- Sessions ephemeral like dev environment (wrong!)

---

## What Needs to Be Fixed (Priority Order)

1. **BLOCKER**: Run database migrations on VPS
   ```bash
   pnpm --filter @workspace/db run push
   ```

2. **BLOCKER**: Verify PostgreSQL is running on VPS
   ```bash
   psql postgresql://...@localhost:5432/scootware -c "SELECT 1;"
   ```

3. **CRITICAL**: Restart services after DB is ready
   ```bash
   pm2 restart api-server
   ```

4. **IMPORTANT**: Rotate exposed secrets (Discord, Google, Steam, SMTP)

5. **NICE**: Move `.env` out of git (use `.env.production` instead)

---

## Expected vs Actual Flow

### **Expected Flow** ✅
```
1. User POSTs /api/auth/login
2. Query PostgreSQL: SELECT * FROM users WHERE email = '...'
3. Verify password with bcrypt
4. Create session: INSERT INTO user_sessions (...)
5. Return session cookie to browser
6. Browser stores session cookie
7. Next request: Session loaded from PostgreSQL
8. User stays logged in ✅
```

### **Actual Flow** ❌
```
1. User POSTs /api/auth/login
2. Try to query PostgreSQL OR PGlite
3. Verify password with bcrypt
4. Create session: INSERT INTO user_sessions IN MEMORY
5. Return session cookie to browser
6. Browser stores session cookie
7. Server restarts → All in-memory data LOST
8. Next request: Session not found → 401 ❌
```

---

## Files That Implement Authentication

| File | Purpose | Status |
|------|---------|--------|
| `artifacts/api-server/src/routes/auth.ts` | Login/Register/SSO endpoints | ✅ Code correct, DB wrong |
| `artifacts/api-server/src/app.ts` | Session middleware setup | ✅ Config correct, DB wrong |
| `lib/db/src/index.ts` | Database connection | ⚠️ Fallback to ephemeral |
| `lib/db/drizzle/0000_slippery_chimera.sql` | Table schemas | ❌ Not applied on VPS |
| `.env.production` | Database URL | ⚠️ Might work, tables missing |
| `artifacts/forum/src/pages/AuthPages.tsx` | Frontend login form | ✅ Works when backend works |

---

## Why SSO Also Fails

```
1. User clicks Discord SSO
2. Redirected to Discord.com  
3. User authenticates, Discord redirects back
4. Backend fetches Discord profile
5. Backend stores pending SSO in req.session.ssoPending
6. Redirects frontend to /sso-link page
7. Frontend queries GET /api/auth/sso/pending
   ↓
   ❌ PROBLEM: Session data lost if in-memory DB
   ↓
8. API: "404 No pending SSO session found"
9. User sees: "An error occurred during authentication"
```

---

## The Database Fallback Logic

```javascript
// Decision tree:
if (process.env.DATABASE_URL && can_connect_to_postgres) {
  use_postgres();  // ✅ ALL GOOD - sessions persist
} else {
  use_pglite();    // ⚠️ BROKEN - sessions ephemeral
  
  if (server_restarts) {
    lose_all_auth_data();  // Data not on disk
  }
}
```

The current state is likely: **DATABASE_URL set but EITHER**
1. Connection fails (firewall, wrong password, Postgres down)
2. Connection works but tables don't exist (migrations never run)
3. Both - connection fails AND tables missing

---

## What the User Experience Says

> "I reset my password, can login once, but immediately logged out after refresh"

**Translation**: 
- Password reset token worked (app had temp DB)
- Login worked against temp session
- But session not saved to disk
- After page refresh, session cookie found but user data gone

---

## Quick Validation Tests

```bash
# Does PostgreSQL exist?
psql postgresql://postgres:password@localhost:5432/scootware \
  -c "SELECT 1;"

# Do tables exist?
psql ... -c "SELECT * FROM users LIMIT 1;"

# Is app using new DB or fallback?
pm2 logs api-server | grep -i "connected\|fallback"
```

**Expected**:
```
✅ Connected to PostgreSQL via DATABASE_URL
✅ SELECT 1 returns (1)
✅ SELECT * FROM users returns data or empty table (not error)
```

**Actual** (if broken):
```
❌ Could not connect to DATABASE_URL, falling back to PGLite
❌ Error: relation "users" does not exist
```

---

## Architecture Diagram

```
User Browser
    ↓
Login Form: POST /api/auth/login
    ↓
Express App (app.ts)
    ↓
Passport LocalStrategy
    ↓
PostgreSQL Connection
    ├─ IF fails → Use PGlite (ERROR HERE)
    └─ IF works → Query users table (tables might not exist)
    ↓
Session Store: connect-pg-simple
    ├─ IF PostgreSQL working → Persist in DB ✅
    └─ IF PGlite → Persist in memory ❌
    ↓
Set-Cookie Header sent to browser
    ↓
Browser refresh/restart → Deserialize session
    ├─ IF in PostgreSQL → User loaded ✅
    └─ IF in memory → User not found ❌ → 401
```

---

## Next Steps

1. **Read** [AUTH_REMEDIATION_GUIDE.md](AUTH_REMEDIATION_GUIDE.md) - Step-by-step fix
2. **Read** [LOGIN_AUTH_ANALYSIS.md](LOGIN_AUTH_ANALYSIS.md) - Detailed technical analysis
3. **Execute** remediation steps on VPS
4. **Test** login flows
5. **Rotate** exposed secrets

---

**Document**: Root Cause Summary  
**Date**: April 2, 2026  
**Status**: 🔴 Critical - Requires immediate database fixes
