# Deployment Quick Reference

## Common Issues & Their Fixes

### Issue: "Files aren't reaching the server"

**Check:**
```bash
cd deployment-manager
python debug_deploy_paths.py ".."
# Look for your expected files in the output
```

**Fix:**
1. Verify project root path in GUI (should contain lib/, artifacts/, package.json)
2. Check that files aren't in the exclude list
3. Try "Clear HashCache & Full Upload"

---

### Issue: "Files end up in wrong location on server"

**Check debug output:**
```
[DEBUG] Local Source (absolute): C:\path\to\Scootware-Forum
[DEBUG] Remote Path (on server): /home/admin/Scootware-Forum
```

**Verify:**
- Local Source should be your project root
- Remote Path should be the directory to extract to

**Fix:**
- Don't set project root to `artifacts/` 
- Don't set it to subdirectories
- Always use the main project root

---

### Issue: "Sensitive files like .env are being uploaded"

**This is now fixed!** The new exclude list prevents:
- ✅ `.env`, `.env.local` 
- ✅ `*.pem`, `*.ppk` (SSH keys)
- ✅ `TEST_CREDENTIALS.md`
- ✅ Other credential files

Just make sure you're using the updated config.

---

### Issue: "Deployment takes too long"

**Previous:** 321 MB, 6,400+ files → 10-15 minutes

**Now:** 67 MB, 1,591 files → 2-3 minutes

Use "Partial Upload (Changed Files)" for fastest updates.

---

## Deployment Scenarios

### Scenario 1: First Deployment

```
1. GUI → Connection → Connect
2. GUI → Deploy → Full Upload (All Files)
3. Wait for upload to complete
4. GUI → Deploy → Build & Restart
5. Verify: http://your-server
```

### Scenario 2: Code Update (Local Dev → Production)

```
1. Make changes locally
2. GUI → Deploy → Partial Upload (Changed Files)
3. GUI → Deploy → Build & Restart
4. Verify changes live
```

### Scenario 3: Something Went Wrong

```
1. GUI → Deploy → Clear HashCache & Full Upload
   (This resets the tracking and forces full re-upload)
2. Wait for complete upload
3. GUI → Deploy → Build & Restart
4. Monitor: GUI → Health → API Status
```

### Scenario 4: Verify What Would Upload

```
# Before deploying, check:
cd deployment-manager
python debug_deploy_paths.py ".."

# Look for your files and excluded items
```

---

## What Gets Uploaded

**YES - Always Uploaded:**
```
lib/                          # Backend code
artifacts/                    # Frontend & API builds  
config/                       # Configuration
package.json                  # Dependencies
ecosystem.config.cjs         # PM2 config
boot.mjs                     # Entry point
.env.production              # Server environment
```

**NO - Never Uploaded:**
```
.env, .env.local             # Dev environment
node_modules/                # Installed on server
.git/                        # Version control
deployment-manager/          # Local tool  
*.pem, *.ppk                 # SSH keys
TEST_CREDENTIALS.md          # Credentials
*.log                        # Log files
```

---

## Path Examples

### ✅ Correct Project Root Paths

```
Windows:
  C:\Users\yourname\Projects\Scootware-Forum
  
Linux/Mac:
  /home/user/Scootware-Forum
  
Relative:
  . (current directory, if in project root)
  .. (parent directory)
```

### ❌ Incorrect Project Root Paths

```
Don't use:
  C:\...\Scootware-Forum\artifacts          ← Too narrow
  C:\...\Scootware-Forum\lib                ← Too narrow
  C:\...\Scootware-Forum\artifacts\forum    ← Way too narrow
```

---

## Environment Files

### Important: .env.production

**On Server:**
- Lives in `/home/admin/Scootware-Forum/.env.production`
- Contains production secrets (API keys, DB passwords, etc.)
- IS uploaded by deployment
- Should never contain development values

**Locally:**
- Create `.env.production` in your project root
- Set production values
- DO NOT commit to git!
- Add to `.gitignore`

### Local Development

**On Your Machine:**
- Use `.env` and `.env.local` for development
- These are NEVER uploaded to production
- Safe place for development secrets

---

## Optimization Tips

### Reduce Upload Time

1. **Use "Partial Upload" when possible**
   - Only changed files upload
   - Default behavior with hash cache
   - Saves bandwidth and time

2. **Organize your file changes**
   - Batch related changes
   - Deploy once instead of multiple times

3. **Monitor upload progress**
   - Watch the GUI output window
   - See file count and size breakdown

### Monitor Server

```bash
# SSH into server and check
pm2 status          # Is API running?
pm2 logs api        # Any errors?
ls -la /home/admin/Scootware-Forum  # File structure correct?
```

---

## Debugging Commands

### Local System

```bash
# Check what would upload
cd deployment-manager
python debug_deploy_paths.py ".."

# Check exclude patterns
python -c "from config import Config; c=Config(); print('\n'.join(c.get('local.tar_exclude', [])))"

# Verify project structure  
ls -la
# Should see: lib/, artifacts/, config/, package.json, boot.mjs
```

### Remote Server (via SSH)

```bash
# Check deployed files
ls -la /home/admin/Scootware-Forum
find /home/admin/Scootware-Forum -name "*.env*" -type f

# Check if sensitive files came over  
ls -la /home/admin/Scootware-Forum/*.pem
ls -la /home/admin/Scootware-Forum/*.ppk

# Verify structure
tree -L 2 /home/admin/Scootware-Forum
```

---

## Quick Checklist

**Before First Deployment:**
- [ ] Project root path is set correctly in GUI
- [ ] Remote path is set to `/home/admin/Scootware-Forum`
- [ ] SSH connection works (test with Connect button)
- [ ] `.env.production` exists locally with prod values
- [ ] `.env` and `.env.local` are in `.gitignore`
- [ ] Run debug script and verify expected files show up

**After Each Deployment:**
- [ ] Check deployment output for errors
- [ ] Verify remote files look correct
- [ ] Test the application
- [ ] Check PM2 status: `pm2 status`
- [ ] Check API health

---

## Need More Help?

1. **See detailed fixes:** Read `DEPLOYMENT_FIXES.md`
2. **Debug output:** Run `python debug_deploy_paths.py ".."`
3. **Check logs:** Look at deployment output in GUI
4. **Verify structure:** Both systems show path details during upload

