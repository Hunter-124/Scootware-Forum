# Scootware Forum

A full-stack web application serving as the central forum and hub for the Scootware ecosystem. The platform provides community discussion, user authentication, product upgrade management, crypto payment verification, and administrative tools.

---

## Architecture Overview

The project is a monorepo managed with **pnpm workspaces**, composed of three main tiers:

| Tier | Technology | Role |
|------|-----------|------|
| **Frontend (Forum)** | Vite + React + TypeScript + shadcn/ui | Community-facing forum with real-time features |
| **Next.js App** | Next.js 16 + React + TypeScript | Authentication flows, user profiles, admin panel |
| **API Server** | Node.js + Express + TypeScript | REST API: auth, forum CRUD, payments, OAuth SSO, crypto verification |
| **Database** | PostgreSQL + Drizzle ORM | Persistent data storage |

### SSO & Payments

- **OAuth SSO**: Google, Discord, Steam (OpenID)
- **Crypto Payments**: Bitcoin, Ethereum, Litecoin, USDT (ERC-20), USDC (ERC-20), Solana
- **Traditional Payments**: Stripe and PayPal (optional, require additional configuration)

---

## Project Structure

```
Scootware-Forum/
├── artifacts/
│   ├── forum/              # React/TypeScript forum frontend (Vite + shadcn/ui)
│   ├── next-app/           # Next.js app (auth, profiles, admin panel)
│   ├── api-server/         # Express API server (all backend logic)
│   └── mockup-sandbox/     # Mockup/preview sandbox (reference only)
├── config/
│   ├── crypto-payments.env # Crypto wallet & payment API configuration template
│   └── sso-and-email.env   # OAuth credentials & SMTP email configuration template
├── deployment-manager/     # Python-based deployment tooling (reference only)
├── lib/
│   ├── db/                 # Database schema, migrations, and Drizzle ORM setup
│   ├── api-client-react/   # TanStack Query React hooks for API consumption
│   ├── api-zod/            # Shared Zod validation schemas
│   └── api-spec/           # OpenAPI specification
├── local-deployment/       # Local deployment scripts and tooling
├── live-deployment/        # VPS deployment scripts (reference only — see SETUP.md)
├── checks-env.mjs          # Environment variable validation utility
├── boot.mjs                # Application bootstrap entry point
├── package.json            # Root workspace configuration
├── pnpm-workspace.yaml     # pnpm workspace definitions
└── tsconfig.json           # Root TypeScript configuration
```

### Database Schema (`lib/db/`)

The Drizzle ORM schema includes the following tables:

- **users** — User accounts with roles (`user`, `mod`, `admin`), OAuth IDs, upgrade tiers, bans, and verification
- **product_access** — Per-user product subscription tracking
- **categories** / **subforums** / **threads** / **posts** — Forum hierarchy and content
- **crypto_payments** — Crypto transaction verification records
- **invite_codes** — Invitation system with product and expiration tracking
- **hwid_reset_requests** — Hardware ID reset request management
- **loader_events** / **login_events** — Audit and activity logging
- **sessions** / **account_changes** — Session management and user action history
- **shoutbox** / **profile_posts** / **attachments** / **site_config** — Supporting tables

---

## Prerequisites

- **Node.js** 22+ (LTS recommended)
- **pnpm** 9+ (package manager for the monorepo)
- **PostgreSQL** 16+ (for production; PGlite for local development fallback)
- **A valid domain** with HTTPS configured (required for OAuth callbacks in production)

### Environment Variables

The project uses environment-based configuration. You must create `.env` files from the templates:

1. **Copy `config/sso-and-email.env`** to `.env` (or `.env.production` for VPS) and fill in real values:
   - `SESSION_SECRET` — Generate with `openssl rand -hex 32`
   - Google, Discord, and Steam OAuth credentials
   - SMTP settings for email delivery
   - `DATABASE_URL` — PostgreSQL connection string
   - `SITE_URL` — Your production domain

2. **Copy `config/crypto-payments.env`** to `.env` (or `.env.production`) and fill in:
   - Wallet addresses for BTC, ETH, LTC, USDT, USDC, SOL
   - Etherscan API key for transaction monitoring

> **⚠️ Security**: Never commit `.env` files with real credentials to source control. The `.gitignore` is pre-configured to ignore them.

---

## Setup Guide

Detailed setup instructions are documented in **[SETUP.md](./SETUP.md)**. This file covers:

- Installing dependencies (`pnpm install`)
- Configuring environment variables for local development and production
- Database setup and migrations (`pnpm --filter @workspace/db run dev`)
- Running the application locally
- Building for production

---

## Usage

### Local Development

```bash
# Install all workspace dependencies
pnpm install

# Start the forum frontend (Vite dev server)
pnpm dev

# Type-check all packages
pnpm run typecheck
```

### Production Build

```bash
# Build all packages (except Next.js app and mockup sandbox)
pnpm run build

# The API server is the primary entry point in production
# It serves the forum frontend, Next.js app, and all API routes
```

### Key Scripts

| Script | Description |
|--------|------------|
| `pnpm dev` | Starts the forum frontend dev server |
| `pnpm run build` | Type-checks and builds all packages |
| `pnpm run typecheck` | Runs TypeScript type checking across the workspace |
| `pnpm run check-env` | Validates that required environment variables are set |

---

## Deployment

### VPS Deployment

Deployment scripts are located in `live-deployment/` and `deployment-manager/`. **These scripts reference old VPS infrastructure and may require updating for current hosting environments.** See **SETUP.md** for detailed deployment guidance and infrastructure requirements.

### Available Deployment Files

- `live-deployment/` — VPS upload and configuration scripts (reference only)
- `deployment-manager/` — Python-based deployment automation (reference only)
- `local-deployment/` — Local deployment and testing tooling

### Environment Configuration for VPS

On the VPS, ensure the following environment variables are set (via your host's environment panel or a `.env.production` file):

- `DATABASE_URL` — PostgreSQL connection string
- `NODE_ENV=production`
- All SSO credentials, SMTP settings, and crypto wallet addresses

---

## Disclaimer

This project is provided **as-is** for reference and community use. The deployment scripts in `live-deployment/` and `deployment-manager/` reference legacy VPS infrastructure and are provided as reference material only — they may not work unchanged on modern hosting environments. Always review and update deployment configurations before use.

Crypto payment verification is a reference implementation. Before deploying a payment-enabled instance, thoroughly audit all wallet addresses, API keys, and transaction monitoring logic.

---

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

See the [LICENSE](./LICENSE) file for the full license text.

> **AGPL-3.0 Note**: If you modify and deploy this software on a network server, you must make the corresponding source code available to users interacting with it remotely over the network. This includes any modifications you make to the codebase.
