# Local Development Setup - FIXED ✅

## Problem Identified
The local development version wasn't working because:

1. **Backend Not Running**: The API server on port 3001 wasn't started
2. **Database Connection Issue**: The `.env` file had `DATABASE_URL` pointing to a PostgreSQL instance that wasn't running
3. **Port Conflict**: Frontend was trying to use port 3000, but the backend expected port 3001

## Solutions Applied

### 1. Disabled PostgreSQL Connection for Development
**File:** `.env`
- **Before**: `DATABASE_URL=postgres://scootadmin:${POSTGRES_PASSWORD}@localhost:5432/scootware`
- **After**: `# DATABASE_URL=postgres://scootadmin:${POSTGRES_PASSWORD}@localhost:5432/scootware` (commented out)
- **Why**: Allows the backend to automatically fallback to **PGlite** (in-memory database) for local development

### 2. Started Backend Server
```bash
node --enable-source-maps "c:\Users\nigga\Downloads\Scootware-Forum\Scootware-Forum\artifacts\api-server\dist\index.mjs"
```
- **Port**: 3001
- **Database**: PGlite (in-memory)
- **Status**: ✅ Running - All migrations applied, initial data seeded
- **Admin Account**: `local-admin` / `localadmin123`

### 3. Started Frontend Dev Server
```bash
cd c:\Users\nigga\Downloads\Scootware-Forum\Scootware-Forum && pnpm run dev
```
- **Port**: 3000
- **Proxy**: `/api` routes to `http://localhost:3001`
- **Status**: ✅ Running - Successfully proxying to backend

## Verification

✅ **Backend API Working**:
```bash
curl http://localhost:3001/api/forum/categories
# Returns: Forum categories with subforums
```

✅ **Frontend Serving**:
```bash
curl http://localhost:3000/
# Returns: HTML with "Scootware Forum" title
```

✅ **Both Servers Connected**:
- Frontend can communicate with backend via proxy
- API responses are being received correctly
- All database migrations applied with PGlite

## How to Start Local Development in the Future

### Option 1: Manual Start (Separate Terminals)
```batch
# Terminal 1 - Start Backend
cd artifacts\api-server
node --enable-source-maps .\dist\index.mjs

# Terminal 2 - Start Frontend
cd ..\..\
pnpm run dev
```

### Option 2: Create a Batch Script
Create `start-dev.bat` in the project root:
```batch
@echo off
echo Starting backend...
start "" node --enable-source-maps "%cd%\artifacts\api-server\dist\index.mjs"

echo Waiting for backend to start...
timeout /t 2 /nobreak

echo Starting frontend...
cd %cd%
call pnpm run dev
```

### Important: Ensure `.env` is Configured for Development
```env
# For LOCAL development (use PGlite):
# DATABASE_URL=postgres://...  (MUST BE COMMENTED OUT)

# For PRODUCTION (use real PostgreSQL):
DATABASE_URL=postgres://username:password@host:port/dbname
```

## Key Ports

| Service | Port | URL |
|---------|------|-----|
| Frontend (Vite) | 3000 | http://localhost:3000 |
| Backend (Express) | 3001 | http://localhost:3001 |
| API Proxy | 3000 → 3001 | Automatic via Vite proxy |

## Database Setup

### Development (What's Running Now)
- **Type**: PGlite (in-memory)
- **Location**: RAM (no disk storage)
- **Migrations**: Applied automatically on startup
- **Data**: Seeded with forum categories and admin user
- **Persistence**: Lost on server restart (expected for dev)

### Production
- **Type**: PostgreSQL (on VPS)
- **Connection**: Via `DATABASE_URL` env variable
- **Location**: `[VPS_IP]` AWS instance
- **Sessions**: Stored in database

## Troubleshooting

### Frontend Shows "API Errors" or No Content
1. Check backend is running on port 3001
2. Verify DATABASE_URL is commented out in `.env`
3. Check for errors in backend terminal output
4. Restart both servers

### "Cannot GET /api/..." Errors
- Ensure backend is running
- Check Vite proxy config: `artifacts/forum/vite.config.ts` (should proxy to localhost:3001)

### Database Errors on Backend Startup
1. Ensure DATABASE_URL is commented out
2. Delete `node_modules` and reinstall: `pnpm install`
3. Rebuild: `pnpm run build`
4. Restart backend

## Next Steps for Deployment

When ready to deploy to production:
1. Set `DATABASE_URL` in `.env` to the VPS PostgreSQL connection
2. Use the Deployment Manager GUI (already configured)
3. Run "Full Deploy (All)" to upload and start on VPS

---

**Current Status**: ✅ Local development environment working correctly
**Last Updated**: March 30, 2026
