# Environment Configuration - Quick Reference

## ✅ What Changed

You now have a **modular environment system** that automatically handles configuration switching without manual edits!

## 📁 Files Created

```
.env                # Shared defaults (in git)
.env.local          # Local dev config (NOT in git - PGlite)
.env.production     # Production config (NOT in git - VPS PostgreSQL)
check-env.mjs       # Verification script
ENV_CONFIGURATION.md # Full documentation
```

## 🚀 How to Use

### Local Development (No Changes!)
```bash
pnpm run dev
# Automatically uses: .env + .env.local
# Database: PGlite (in-memory)
# ✅ Works as before!
```

### Check Configuration
```bash
pnpm run check-env
# Shows which files are loaded
# Verifies DATABASE_URL is correct for the environment
```

### Build for Production (Before Deploying)
```bash
pnpm run build:prod
# Uses: .env + .env.production
# Database: PostgreSQL on [VPS_IP]
# ✅ Ready for VPS deployment!
```

## 🔄 Automatic Environment Loading

**The magic is in `dotenv` package:**

```
NODE_ENV=development → Loads: .env + .env.local (PGlite)
NODE_ENV=production  → Loads: .env + .env.production (VPS PostgreSQL)
```

No manual configuration needed!

## 📋 Environment File Comparison

| Setting | .env.local (Dev) | .env.production (Prod) |
|---------|------------------|------------------------|
| DATABASE_URL | ❌ Commented out | ✅ postgres://...@[VPS_IP] |
| SITE_URL | `http://localhost:3000` | `https://scootware.us` |
| Database | PGlite (RAM) | PostgreSQL (VPS) |
| Discord URL | `http://localhost:3000/api/...` | `https://scootware.us/api/...` |

## ✨ Benefits

✅ **No more manual edits** - Configuration is automatic  
✅ **No accidental commits** - Env files in .gitignore  
✅ **Seamless switching** - Just change NODE_ENV  
✅ **Clear separation** - Dev and prod configs separate  
✅ **Scriptable** - Easy to verify with check-env command  

## 🔐 Security

- `.env.local` and `.env.production` are in `.gitignore`
- Production secrets never accidentally committed
- Each environment has isolated configuration

## 🐛 Troubleshooting

**"Backend not responding locally"**
```bash
pnpm run check-env
# Should show: DATABASE_URL is commented out (correct!)
```

**"About to deploy but worried about config"**
```bash
pnpm run build:prod && pnpm run check-env
# Verifies production setup before deployment
```

## 📚 Full Details

See [ENV_CONFIGURATION.md](ENV_CONFIGURATION.md) for:
- Detailed explanation of how it works
- Deployment workflow
- Advanced configuration
- Troubleshooting guide

---

**Summary**: You can now develop locally and deploy to production without breaking anything! 🎉
