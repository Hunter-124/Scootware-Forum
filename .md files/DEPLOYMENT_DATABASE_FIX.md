# Database Migration Error Fix

## Problem
During deployment, the error `Error: getaddrinfo ENOTFOUND base` occurs when running:
```
pnpm --filter @workspace/db run push-force
```

## Root Cause
The deployment was attempting to run database migrations without a valid `DATABASE_URL` configured for the VPS environment, causing Drizzle Kit to fall back to an invalid connection string.

## Solution Applied

### 1. Updated `.env.production`
The production environment file now has `DATABASE_URL` set to empty by default, which tells the deployment script to **skip migrations during deployment**. This is the safer approach because:
- Database setup should be handled separately on the VPS
- Prevents connection failures during deployment
- Migrations can be run manually once the database is verified working

### 2. Updated `lib/db/drizzle.config.ts`
Enhanced the Drizzle configuration to:
- Handle missing `DATABASE_URL` gracefully in production
- Skip database validation when migrations aren't needed
- Provide clear warnings about what needs to be done

### 3. Remote Deployment Script
The `live-deployment/remote-manage.sh` already had proper logic to skip migrations when `DATABASE_URL` is not set.

## How to Run Migrations (if needed)

### Option 1: After Deployment (Recommended)
Once deployed and the VPS is running, SSH into the VPS and run:
```bash
ssh -i your-key.pem admin@[VPS_IP]

# Set DATABASE_URL on the VPS
export DATABASE_URL="postgresql://postgres:[POSTGRES_PASSWORD]@127.0.0.1:5432/scootware"

# Run migrations
cd /home/admin/Scootware-Forum
pnpm --filter @workspace/db run push-force
```

### Option 2: Configure Before Deployment
If you want to run migrations during deployment, edit `.env.production` and set:
```env
DATABASE_URL="postgresql://postgres:yourpassword@127.0.0.1:5432/scootware"
```

**Important**: Make sure the database server is running and accessible on the VPS before deployment.

## Verification

After deployment, verify the database is working by running on the VPS:
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U postgres -h 127.0.0.1 -d scootware -c "SELECT version();"
```

## Configuration Files Modified
- `.env.production` - Set DATABASE_URL to empty (skip migrations)
- `lib/db/drizzle.config.ts` - Better error handling for missing DATABASE_URL
- No changes needed to `live-deployment/remote-manage.sh` (already handles this properly)

## Next Steps
1. Run the deployment via the GUI app again - it should now complete without the database error
2. After confirming the deployment is successful, manually run migrations on the VPS if needed
3. Test the forum at `https://scootware.us` or `http://[VPS_IP]`
