# Scootware.us - Master Deployment Guide (v1.0)

This guide provides the complete blueprint for taking your project from local development to a production-ready AWS instance.

## 📋 Pre-Flight Checklist

1.  **DNS Verification**: Point `scootware.us` and `www.scootware.us` to your VPS Elastic IP (**[VPS_IP]**).
2.  **VPS IPs**: 
    - **Public IP**: `[VPS_IP]` (Use this for SSH/SFTP)
    - **Private IP**: `172.26.11.238` (Internal network only)
3.  **SSH Key Access**: Add your local `~/.ssh/id_rsa.pub` to the VPS `~/.ssh/authorized_keys`.
4.  **Local Sync Prerequisites**: Ensure `rsync` is installed locally (available via Git Bash, WSL, or standalone installer).

---

## 🚀 1. Initial VPS Setup

Only required once on a fresh Ubuntu 22.04+ server.

1.  **SSH into your server**:
    ```bash
    ssh admin@[VPS_IP]
    ```
2.  **Run the AWS setup script**:
    (Assuming the code has been synced for the first time):
    ```bash
    cd /home/admin/Scootware-Forum/deployment-tools/
    sudo bash setup-aws.sh
    ```
    *This installs Node.js, pnpm, PM2, and configures the base Nginx block.*

---

## 📦 2. Single-Command Deployment

From the root of your project on your **local Windows machine**, run:

```powershell
.\deployment-tools\deploy-local.ps1
```

**This script will:**
- Sync only production-relevant code (skips `node_modules`, `.git`, etc.).
- Establish the app structure on the server.
- Automatically trigger the server-side build and restart.

---

## 🔐 3. Production Environment Secret Management

On the VPS, create a `.env` file in `/home/admin/Scootware-Forum/.env`. 

> [!CAUTION]
> NEVER share this file. It contains your real secrets.

```bash
# Database
DATABASE_URL=postgres://scootadmin:${POSTGRES_PASSWORD}@localhost:5432/scootware

# Services 
SESSION_SECRET=... # Generate a 64-char random string
STEAM_API_KEY=AE4EADB8217450B5CD8182F7F4E5AE6B
DISCORD_CLIENT_ID=1487692664643256420
DISCORD_CLIENT_SECRET=T0dPpRUJxTdu92rwb59aeaK6qcnSlu8a
SMTP_PASS=jgnt npvs yuxb nzxi

# Crypto
ETHERSCAN_API_KEY=4I23NVSUYPEBI415TWG44I66AE5YZRX2UT
CRYPTO_BTC_WALLET=... # Your real BTC address
CRYPTO_ETH_WALLET=... # Your real ETH address
```

---

## 🛠️ 4. Manual On-Server Management

You can perform unified tasks on the server using `remote-manage.sh`:

- **Update Core**: `bash deployment-tools/remote-manage.sh update` (Runs `pnpm install` and Migrations)
- **Rebuild Frontends**: `bash deployment-tools/remote-manage.sh build`
- **Full Refresh**: `bash deployment-tools/remote-manage.sh restart` (Cleans PM2 and Reloads Nginx)

---

## 🔒 5. Final Hardening

### Enable SSL (HTTPS)
Run Certbot on the VPS:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d scootware.us -d www.scootware.us
```

### Auto-Start on Reboot
```bash
pm2 save
pm2 startup
```

---
*Scootware Forum is now production-hardened.*
