# Environment Configuration Strategy

## Problem Solved ✅
Previously, you had to manually comment/uncomment the `DATABASE_URL` in a single `.env` file to switch between development and production. This is error-prone and easy to forget.

## Solution: Modular Environment Files

The project now uses a **three-tier environment configuration system**:

### Tier 1: Shared Defaults (`.env`)
- **Location**: `.env` (committed to git)
- **Purpose**: Common settings used in all environments
- **Contains**: Shared secrets, API keys, non-environment-specific config
- **NOTE**: Does NOT contain `DATABASE_URL` - environment-specific

### Tier 2: Environment-Specific Overrides
Two files are provided for different contexts:

#### `.env.local` - LOCAL DEVELOPMENT
- **When to use**: `pnpm run dev` (developing locally)
- **Database**: PGlite (in-memory) - `DATABASE_URL` is commented out
- **Site URL**: `http://localhost:3000`
- **Do NOT commit**: Optionally add to `.gitignore` if you have local overrides
- **Created**: ✅ Already set up

#### `.env.production` - PRODUCTION VPS
- **When to use**: Before `pnpm run build` for VPS deployment
- **Database**: PostgreSQL on VPS - `DATABASE_URL=postgres://...@[VPS_IP]:5432/scootware`
- **Site URL**: `https://scootware.us`
- **Do NOT commit**: Contains production secrets (add to `.gitignore`)
- **Created**: ✅ Already set up

### Tier 3: System Environment Variables (Highest Priority)
- **When to use**: On VPS, container, or CI/CD environments
- **Purpose**: Override any file-based settings
- **Used by**: Deployment manager and server orchestration

---

## How It Works

The `dotenv` package loads configuration in this order (last wins):

```
1. Load .env               (shared defaults)
2. Load .env.{NODE_ENV}   (environment-specific, e.g., .env.local or .env.production)
3. Load system env vars    (highest priority)
```

### Example Scenarios

**Scenario 1: Running Locally**
```bash
NODE_ENV=development pnpm run dev
# Loads: .env + .env.local
# Uses: PGlite (DATABASE_URL commented out in .env.local)
# ✅ Works with http://localhost:3000
```

**Scenario 2: Building for Production**
```bash
NODE_ENV=production pnpm run build
# Loads: .env + .env.production
# Uses: PostgreSQL on VPS (DATABASE_URL from .env.production)
# ✅ Ready for VPS deployment
```

**Scenario 3: VPS Deployment**
```bash
# VPS runs with environment variables set by PM2/deployment manager
# Env vars override all file-based settings
# DATABASE_URL=postgres://... (from VPS environment)
# ✅ Connects to VPS PostgreSQL automatically
```

---

## Deployment Workflow

### Before Going Live

1. **Local Development** (Current - No changes needed!)
   ```bash
   pnpm run dev  # Automatically uses .env + .env.local (PGlite)
   ```

2. **Pre-Deployment Check**
   ```bash
   NODE_ENV=production pnpm run build
   # Verifies build works with production config (.env.production)
   # Uses .env.production DATABASE_URL pointing to VPS PostgreSQL
   ```

3. **Deploy to VPS**
   ```bash
   # Use the Deployment Manager GUI
   # It will upload the built code
   # VPS PM2 processes run with system environment variables
   # DATABASE_URL automatically set to connect to VPS PostgreSQL
   ```

---

## File Locations & Purposes

```
Scootware-Forum/
├── .env                 ← Shared defaults (COMMIT)
├── .env.local          ← Local dev overrides (DON'T COMMIT)
├── .env.production     ← Production overrides (DON'T COMMIT)
├── .gitignore          ← Should ignore .env.local and .env.production
├── artifacts/
│   ├── forum/          ← Frontend
│   └── api-server/     ← Backend (loads .env files)
└── local-deployment/deployment-manager/ ← GUI app for VPS deployment
```

---

## No Manual Configuration Needed!

✅ **Local Development**: Just run `pnpm run dev` - automatically uses `.env.local`
✅ **Build Production**: Just run `NODE_ENV=production pnpm run build` - uses `.env.production`
✅ **Deploy to VPS**: GUI deployment manager handles environment variables

---

## gitignore Configuration

Add this to `.gitignore` to prevent committing secrets:

```gitignore
# Environment variables
.env.local
.env.production
.env.*.local
```

---

## Quick Reference Table

| Use Case | Command | Config Files | Database | DATABASE_URL |
|----------|---------|--------------|----------|--------------|
| Local Dev | `pnpm run dev` | .env + .env.local | PGlite | Commented out |
| Build Prod | `NODE_ENV=production pnpm run build` | .env + .env.production | PostgreSQL | VPS ([VPS_IP]) |
| VPS Live | `NODE_ENV=production pm2 start ecosystem.config.cjs` | System env vars | PostgreSQL | System environment |

---

## Troubleshooting

### "Backend not connecting to database locally"
**Fix**: Make sure `.env.local` exists and `DATABASE_URL` is commented out
```bash
grep "DATABASE_URL" .env.local  # Should show commented line
```

### "Production build fails"
**Fix**: Ensure `.env.production` exists with valid DATABASE_URL
```bash
NODE_ENV=production node -e "console.log(process.env.DATABASE_URL)"
```

### "VPS backend showing wrong database"
**Fix**: Check VPS environment variables are set correctly
```bash
# On VPS:
env | grep DATABASE_URL
```

---

## Next Steps

1. ✅ Both `.env.local` and `.env.production` are created
2. ✅ No changes needed to continue local development
3. **Before deploying**: Verify `.env.production` has correct VPS credentials
4. **To deploy**: Use the Deployment Manager GUI as before

Everything is now **modular and automatic**! 🎉
