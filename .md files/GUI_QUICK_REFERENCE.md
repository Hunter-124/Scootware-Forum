# Scootware Forum - GUI Deployment Quick Reference

## 🚀 60-Second Deployment

### Every Time You Deploy

```
1. Open Deployment Manager GUI
2. 🔌 Connection tab → Click "Connect"
3. 🚀 Deploy tab → Click "Upload Changed Files Only"
4. Click "Build & Deploy"
5. Wait for ✅ (green success)
6. Visit http://[VPS_IP]
7. Done! ✨
```

**Time**: ~5-10 minutes  
**Database patches**: Applied automatically ✅  
**Nginx config**: Applied automatically ✅  
**Health checks**: Run automatically ✅

---

## 🎯 What Each Button Does

### Upload Section
| Button | Use Case | Speed |
|--------|----------|-------|
| **Upload Changed Files Only** | Normal deployments (code updated locally) | Fast (2-5 min) |
| **Full Upload (Reset Cache)** | Fresh start, cache corruption | Slow (10-15 min) |

### Build & Deploy
| Button | What It Does | Speed |
|--------|--------------|-------|
| **Build & Deploy** | Upload (if changed) + Build + Migrate DB + Restart + Health checks | 5-10 min |

### Service Controls
| Button | Purpose | When to Use |
|--------|---------|------------|
| **Start** | Start services | After stop or fresh server |
| **Stop** | Stop services | Maintenance mode |
| **Restart** | Restart services | Service fix without code upload |

---

## ⭐ Recommended Workflows

### Scenario A: Code Changes
```bash
Make code changes locally
↓
Upload Changed Files Only (2 min)
↓
Build & Deploy (5-10 min)
```

### Scenario B: Clean Server
```bash
Full Upload (Reset Cache) (10-15 min)
↓
Build & Deploy (5-10 min)
```

### Scenario C: Just Restart
```bash
Restart (3-5 min)
```
*Includes automatic DB migrations and health checks*

---

## ✅ How to Know It Worked

**Success indicators**:
- Output shows ✓ checkmarks
- Green message: "✅ DEPLOYMENT COMPLETE"
- HTTP 200 at http://[VPS_IP]
- Health tab shows "✓ Healthy"

**Error indicators**:
- Output shows ❌ errors
- Red message: "ERROR: ..."
- You see "FAILED" in bold
- Health tab shows "✗ Unhealthy"

---

## 🔨 Setting Up (One Time)

1. Open GUI
2. 🔌 Connection tab:
   - Host: `[VPS_IP]`
   - User: `admin`
   - PEM Key: Browse to `scootware.pem`
   - Remote: `/home/admin/Scootware-Forum`
3. Click "Connect" ✓
4. 🚀 Deploy tab:
   - Project Root: Browse to local Scootware-Forum folder
5. Click "Save Configuration"

**Settings now saved** - next time just click "Connect" 🚀

---

## 📊 What Happens Automatically

✅ Database migrations (patches)
✅ Nginx configuration
✅ Health checks
✅ PM2 service restart
✅ Static asset serving
✅ Environment variable loading

*No manual steps needed - all in the button!*

---

## 🆘 Troubleshooting

| Problem | Fix |
|---------|-----|
| "Upload failed" | Click "Full Upload (Reset Cache)" |
| "Build failed" | Check local: `pnpm run build` |
| "API won't start" | Click Stop, then Start |
| "Nginx error" | Click Restart |
| Unsure of status | Go to ❤️ Health → "Full Diagnostics" |

---

## 📋 Deployment Checklist

Before clicking "Upload Changed Files Only":
- [ ] Made code changes locally
- [ ] Tested locally with `pnpm run build`
- [ ] Connected to VPS (green "Connected" status)

After "Build & Deploy":
- [ ] Watch for ✅ in output
- [ ] Wait 2-3 min for server to initialize
- [ ] Visit http://[VPS_IP]
- [ ] Check website loads correctly
- [ ] Check API responds (go to ❤️ Health tab)

---

## 🔄 Typical Frequency

- **Code changes**: Every few minutes during development
- **Database schema changes**: Automatic (handled by DB migrations)
- **Server restart**: Only when needed (~once per day during active dev)
- **Full upload**: Rarely (~once per month, only if cache issues)

---

## 💾 Configuration Auto-Save

Once you set up:
- 🔌 Connection: Saved automatically
- 🚀 Project Root: Saved automatically
- ⚙️ Settings: Saved automatically

Just click Connect next time, you're good to go!

---

## 📞 Emergency Stop

Need to take the site offline:
1. Go to 🚀 Deploy tab
2. Click "Stop"
3. Confirm in dialog
4. Website goes down (useful for maintenance)

To bring back online:
1. Click "Start"
2. Website comes back up

---

## 🎓 Understanding the Flow

```
Your Local Code
       ↓
[Upload Changed Files]
       ↓
Files on VPS
       ↓
[Build & Deploy] automatically:
   ├─ Apply DB migrations
   ├─ Build frontend + API
   ├─ Restart PM2 services
   ├─ Configure Nginx
   └─ Run health checks
       ↓
Live at http://[VPS_IP]
```

**Total time**: 5-10 minutes  
**Manual intervention needed**: None (it's all automatic!)

---

## 📱 Health Monitoring

After deployment, check health:
1. Go to ❤️ Health tab
2. Click "Check API Status"
3. Should show: `✓ Healthy`
4. Visit http://[VPS_IP] in browser

---

## 🔑 Commands Summary

**Most common**:
- `[Connect]` → Authentication
- `[Upload Changed Files Only]` → Upload
- `[Build & Deploy]` → Full deployment

**Sometimes**:
- `[Restart]` → Quick restart
- `[Stop]` → Emergency stop

**Rarely**:
- `[Full Upload (Reset Cache)]` → Cache issues
- `[Start]` → After manual service stop

---

## ✨ Pro Tips

1. **Chain commands**: Upload → immediately Build & Deploy (both buttons)
2. **Watch output**: Read the output for progress (educational!)
3. **Use Restart**: When you just want to apply DB patches (no code upload)
4. **Check health**: Always verify after deployment
5. **Keep logs**: Copy deployment output if something goes wrong (for support)

---

## 📚 Full Documentation

For detailed explanations, see: `GUI_DEPLOYMENT_MANUAL.md`

This quick reference is for the common case.

---

**Version**: Streamlined GUI v2  
**Last Updated**: April 3, 2026  
**Database Patches**: Auto-applied during every restart ✅
