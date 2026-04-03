# Login Issue Fix - Implementation Guide

## Problem Summary
Users unable to login to the Scootware Forum website at `https://scootware.us` with "Invalid credentials" error, even though accounts exist in the database.

## Root Cause Analysis
1. **Missing `.env` file** - The application was not loading the correct environment configuration on the VPS
2. **Database not migrated** - While tables exist, the configuration wasn't properly initialized
3. **Session management not initialized** - Without proper `.env`, session persistence wasn't working
4. **Application restart required** - Configuration changes needed app rebuild and service restart

## Prerequisites
- SSH access to VPS server
- SSH key file (e.g., `scootware.pem`)
- Database credentials available in `.env.production`
- PM2 and pnpm already installed on server

## Step-by-Step Implementation

### Step 1: SSH into the Server
```bash
ssh -i /path/to/scootware.pem admin@[VPS_IP]
cd /home/admin/Scootware-Forum
```

### Step 2: Verify and Copy Environment Configuration
The `.env` file is missing but `.env.production` contains the correct configuration.

**Check if .env exists:**
```bash
ls -la .env .env.production
```

**Copy production config to .env:**
```bash
cp .env.production .env
```

**Verify the DATABASE_URL is set:**
```bash
grep DATABASE_URL .env
```

Expected output:
```
DATABASE_URL="postgresql://postgres:[POSTGRES_PASSWORD]@127.0.0.1:5432/scootware"
```

### Step 3: Run Database Migrations
Even though tables exist, ensure the schema is fully initialized:

```bash
pnpm --filter @workspace/db run push
```

Expected output:
```
[✓] Pulling schema from database...
[i] No changes detected
```

If there are changes detected, it will apply them automatically.

### Step 4: Rebuild the Application
Compile TypeScript and build all artifacts:

```bash
pnpm run build
```

This compiles:
- Backend API server (`artifacts/api-server`)
- Frontend forum application (`artifacts/forum`)

Expected build time: 1-2 minutes

### Step 5: Restart Services
Restart PM2 processes and nginx:

```bash
pm2 restart all
sleep 3
sudo systemctl restart nginx
```

**Verify services are running:**
```bash
pm2 list
pm2 logs scootware-api --lines 10
```

Look for log line: `{"level":30,...,"msg":"Server listening"}`

### Step 6: Verify Login Functionality

**Test the login endpoint with built-in admin account:**
```bash
python3 << 'EOF'
import json
import urllib.request
import urllib.error

url = 'http://localhost:3000/api/auth/login'
data = json.dumps({'identifier': 'local-admin', 'password': 'localadmin123'}).encode('utf-8')
headers = {'Content-Type': 'application/json'}

req = urllib.request.Request(url, data=data, headers=headers, method='POST')
try:
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode('utf-8'))
        if 'user' in result:
            print('✓ Login successful!')
            print(f"User: {result['user']['username']}")
            print(f"Role: {result['user']['role']}")
except urllib.error.HTTPError as e:
    print(f'✗ Login failed: {e.code}')
EOF
```

Expected output:
```
✓ Login successful!
User: local-admin
Role: admin
```

### Step 7: Check Database User Accounts

**List all user accounts:**
```bash
export PGPASSWORD='[POSTGRES_PASSWORD]'
psql -h 127.0.0.1 -U postgres -d scootware -c "SELECT username, email, role FROM users ORDER BY created_at DESC LIMIT 10;"
```

Expected output should show all user accounts including `local-admin`, `testuser`, and any custom accounts.

## Available Test Credentials

After the fix is applied, these accounts are available for testing:

### Built-in Admin Account
- **Username:** `local-admin`
- **Password:** `localadmin123`
- **Email:** `local-admin@scootware.test`
- **Role:** Admin

### Built-in Test User Account
- **Username:** `testuser`
- **Password:** `testuser123`
- **Email:** `testuser@scootware.test`
- **Role:** User

## Resetting User Passwords

If you need to reset a user's password (e.g., `[TEST_USERNAME]`), use the password reset endpoint or database update.

**Using Node.js script (from project directory):**
```bash
cd /home/admin/Scootware-Forum
node << 'EOF'
const { createClient } = require('../../node_modules/.pnpm/pg@16.13.0/node_modules/pg');
const bcrypt = require('bcrypt');

const client = new createClient({
  host: '127.0.0.1',
  user: 'postgres',
  password: '[POSTGRES_PASSWORD]',
  database: 'scootware'
});

(async () => {
  try {
    await client.connect();
    const result = await client.query('SELECT id FROM users WHERE username = $1', ['[TEST_USERNAME]']);
    
    if (result.rows.length > 0) {
      const userId = result.rows[0].id;
      const newPassword = 'Temp@12345';
      const hash = await bcrypt.hash(newPassword, 12);
      await client.query('UPDATE users SET passwordHash = $1 WHERE id = $2', [hash, userId]);
      console.log(`✓ Password reset to: ${newPassword}`);
    } else {
      console.log('User not found');
    }
  } finally {
    await client.end();
  }
})();
EOF
```

## Verification Checklist

- [ ] SSH connection successful
- [ ] `.env` file exists and contains `DATABASE_URL`
- [ ] Database migrations completed (no errors)
- [ ] Application rebuilt successfully
- [ ] PM2 services restarted and running
- [ ] nginx restarted
- [ ] Login endpoint responds to test request
- [ ] Built-in accounts (local-admin/testuser) can login via API
- [ ] Custom user accounts exist in database
- [ ] Website at `https://scootware.us` is accessible

## Troubleshooting

### Login still fails after following these steps

**Check PM2 logs for errors:**
```bash
pm2 logs scootware-api --lines 50
```

**Common issues:**
- Database connection error → Verify DATABASE_URL and PostgreSQL is running
- Session table missing → Run `pnpm --filter @workspace/db run push` again
- Nginx proxy error → Check nginx logs: `sudo tail -50 /var/log/nginx/error.log`

### "Cannot find module" errors during build

```bash
pnpm install
pnpm run build
```

### Services won't restart

```bash
pm2 kill
pm2 resurrect
```

## Files Modified/Created
- `.env` - Copied from `.env.production`
- No source code changes required
- No database schema changes (already correct)

## Summary

The fix resolves the login issue by:
1. Ensuring the application loads correct environment configuration (`.env`)
2. Verifying database schema is initialized
3. Rebuilding the application with current configuration
4. Restarting services to apply all changes

The system is now ready for users to login using any valid credentials in the `users` table, or the built-in test accounts.
