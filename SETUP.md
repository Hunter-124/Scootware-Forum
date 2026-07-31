# Scootware Forum — Deployment Setup Guide

This guide documents how to set up the Scootware Forum from scratch on your own infrastructure. The deployment scripts in `deployment-manager/`, `live-deployment/`, and `local-deployment/` are reference implementations from a previous VPS setup. They will need to be adapted to your own environment.

## Prerequisites

- **Node.js** ≥ 22.x
- **pnpm** ≥ 9.x
- **PostgreSQL** ≥ 16
- **A VPS or cloud server** with a public IP
- **A domain name** (for HTTPS and OAuth callbacks)
- **An SMTP service** (Gmail App Password, SendGrid, or AWS SES)
- **OAuth applications** registered for Google, Discord, and Steam
- **Payment processor accounts** (Stripe, PayPal — optional, crypto payments work without them)

## 1. Clone and Install

```bash
git clone <repo-url>
cd Scootware-Forum
pnpm install
```

## 2. Configure Environment Variables

Copy the template files and fill in your real values:

```bash
cp config/crypto-payments.env.template config/crypto-payments.env
cp config/sso-and-email.env.template config/sso-and-email.env
```

### SSO & Email (`config/sso-and-email.env`)

| Variable | Description |
|----------|-------------|
| `SESSION_SECRET` | Random 64-char string. Generate: `openssl rand -hex 32` |
| `GOOGLE_CLIENT_ID` | From https://console.developers.google.com/ |
| `GOOGLE_CLIENT_SECRET` | From the Google Cloud console |
| `DISCORD_CLIENT_ID` | From https://discord.com/developers/applications |
| `DISCORD_CLIENT_SECRET` | From the Discord developer portal |
| `STEAM_API_KEY` | From https://steamcommunity.com/dev/apikey |
| `SMTP_HOST` | e.g., `smtp.gmail.com` |
| `SMTP_USER` | Your email address |
| `SMTP_PASS` | Your SMTP password or app password |
| `SITE_URL` | Your production domain (e.g., `https://yourdomain.com`) |

### Crypto Payments (`config/crypto-payments.env`)

| Variable | Description |
|----------|-------------|
| `CRYPTO_BTC_WALLET` | Your Bitcoin receiving address |
| `CRYPTO_ETH_WALLET` | Your Ethereum receiving address |
| `CRYPTO_LTC_WALLET` | Your Litecoin receiving address |
| `CRYPTO_USDT_WALLET` | Your USDT (ERC-20) receiving address |
| `CRYPTO_USDC_WALLET` | Your USDC (ERC-20) receiving address |
| `CRYPTO_SOL_WALLET` | Your Solana receiving address |
| `ETHERSCAN_API_KEY` | Free key from https://etherscan.io/apis |

## 3. Database Setup

Set `DATABASE_URL` as an environment variable pointing to your PostgreSQL instance, or use PGlite for local development.

```bash
# Local dev (uses PGlite in-memory database)
export DATABASE_URL="postgresql://user:pass@host:5432/scootware"
```

Run migrations:
```bash
cd lib/db
npx drizzle-kit push
```

## 4. OAuth Application Setup

### Google OAuth
1. Go to https://console.developers.google.com/
2. Create a new project
3. Enable the Google+ API
4. Create OAuth 2.0 credentials
5. Set authorized redirect URI to `[YOUR_DOMAIN]/api/auth/sso/google/callback`
6. Copy the Client ID and Client Secret

### Discord OAuth
1. Go to https://discord.com/developers/applications
2. Create a new application
3. Go to the "OAuth2" tab
4. Set redirect URI to `[YOUR_DOMAIN]/api/auth/sso/discord/callback`
5. Copy the Client ID and Client Secret

### Steam OpenID
1. Go to https://steamcommunity.com/dev/apikey
2. Enter your domain
3. Copy the API key

## 5. Building and Running

### Development Mode
```bash
cd artifacts/next-app
pnpm dev
```

### Production Build
```bash
cd artifacts/next-app
pnpm build
pnpm start
```

### API Server
```bash
cd artifacts/api-server
pnpm dev
```

## 6. Deployment (New Infrastructure)

Since the existing `deployment-manager/` and `live-deployment/` scripts reference a specific old VPS configuration, we recommend setting up fresh deployment using:

1. **VPS**: Spin up a new Linux VPS (Ubuntu 22.04+ recommended)
2. **Reverse Proxy**: Configure nginx (see `nginx-https.conf` as a reference, but update all paths and domains)
3. **SSL**: Use Let's Encrypt or your hosting provider's SSL
4. **Process Manager**: Use `pm2` or systemd to manage the Node.js API server and Next.js frontend
5. **Database**: Set up PostgreSQL on the VPS or use a managed database service
6. **Environment**: Set all env vars as systemd environment files or in a `.env` file that is NOT committed

### Key Environment Variables for Production
```
DATABASE_URL=postgresql://user:pass@host:5432/scootware
NODE_ENV=production
SITE_URL=https://yourdomain.com
```

## 7. Important Notes

- **Never commit `config/*.env` files with real values to source control.** The `.env` files listed in `.gitignore` will be automatically excluded. Use `.env.example` as a template.
- **The existing `deployment-manager/` scripts contain references to the old VPS IP and SSH key.** Update all hardcoded values before using them.
- **Crypto wallet addresses should be per-deployment (unique receiving addresses for each coin).** Do not reuse main wallet addresses directly.
- **The forum collects user emails and passwords.** Ensure compliance with applicable data protection regulations (GDPR, etc.).

## 8. SSL/HTTPS Setup (Reference)

See `nginx-https.conf` for a reference nginx configuration. Update all `server_name` directives to match your domain. Obtain certificates via Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## 9. Backup Strategy

- PostgreSQL: Use `pg_dump` regularly and store encrypted backups offsite
- Uploads dir: Back up user-attached files
- Database: Enable WAL archiving for point-in-time recovery