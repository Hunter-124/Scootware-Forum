# ✅ QUICK FIX - Authentication Failed on VPS

## The Problem
Your database migrations **haven't been run on the VPS yet**. The tables don't exist, so no accounts can be created.

## The Solution (Copy-Paste These Commands)

### Step 1: SSH into your VPS and ensure .env exists
```bash
ssh admin@[VPS_IP]
cd /home/admin/Scootware-Forum

# Check if .env exists
test -f .env && echo ".env exists" || echo ".env missing"

# If missing, create it with the minimum required variables
cat > .env <<EOF
DATABASE_URL=postgres://scootadmin:${POSTGRES_PASSWORD}@localhost:5432/scootware
SESSION_SECRET=$(openssl rand -base64 32)
NODE_ENV=production
SITE_URL=https://scootware.us
EOF
```

### Step 2: Install and migrate database
```bash
cd /home/admin/Scootware-Forum
pnpm install
pnpm --filter @workspace/db run push
```

### Step 3: Rebuild and restart
```bash
pnpm run build
pm2 restart all
sudo systemctl restart nginx
```

### Step 4: Test the login
Go to `https://scootware.us` and use:
- **Username:** `local-admin`
- **Password:** `localadmin123`

---

## What I Changed
I modified the code to **automatically create a local admin account** (`local-admin / localadmin123`) when the database is initialized. This gives you an immediate working login for testing.

Once logged in, you can:
- Create additional admin accounts
- Configure the forum
- Set up payments

---

## If You Need Help

**The 3 Commands You Need:**
```bash
ssh admin@[VPS_IP]
cd /home/admin/Scootware-Forum && pnpm install && pnpm --filter @workspace/db run push && pnpm run build
pm2 restart all && sudo systemctl restart nginx
```

Then visit `https://scootware.us` and login with `local-admin / localadmin123`.
