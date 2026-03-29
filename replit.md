# Scootware Forum

## Overview

A full-stack web forum for Scootware — a driver tools software company. Users purchase account upgrades to access exclusive driver product forums, share configs, and get support.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/forum)
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Passport.js (local, Google OAuth2, Discord OAuth2, Steam OpenID)
- **Sessions**: express-session + connect-pg-simple (stored in PostgreSQL)
- **Email**: Nodemailer (configurable SMTP)
- **File uploads**: Multer + Sharp (secure avatar processing)
- **Validation**: Zod
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)

## Structure

```text
artifacts/forum/              # React + Vite frontend (served at /)
artifacts/api-server/         # Express API server (served at /api)
lib/api-spec/openapi.yaml     # OpenAPI spec (source of truth)
lib/api-client-react/         # Generated React Query hooks
lib/api-zod/                  # Generated Zod schemas
lib/db/src/schema/            # Database schema (Drizzle)
config/sso-and-email.env      # SSO & email credential config (fill in before deploy)
uploads/avatars/              # Uploaded user avatars (auto-created)
```

## Forum Structure

**Categories & Subforums:**
- General: General Discussion, Announcements (read-only)
- Driver Products (requires upgrade):
  - BC1482: Updates, Support, Config Sharing, Showcase
  - RU1823: Updates, Support, Config Sharing, Showcase
  - DZ1923: Updates, Support, Config Sharing, Showcase
  - TK7321: Updates, Support, Config Sharing, Showcase
  - SPF1643: Updates, Support, Config Sharing, Showcase

## User Roles & Upgrades

- **Roles**: user, admin
- **Upgrade types**: basic (30 days), premium (30 days), lifetime
- Upgrade required to access driver product forums

## Authentication

- Email/password with email verification
- Google SSO (configure GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)
- Discord SSO (configure DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET)
- Steam OpenID (configure STEAM_API_KEY)

## Configuration

All SSO and email credentials are configured in `config/sso-and-email.env`.
Copy values to your hosting environment variables before deployment.

## Admin Panel

- Accessible at `/admin` (admin role required)
- User management: search, update username/role/upgrade, ban/unban
- Site configuration: name, description, maintenance mode, registration toggle
- Admin controls also appear on user profile pages

## Security Features

- Avatars processed through Sharp (resize + re-encode) to prevent exploits
- File size limits (2MB), MIME type whitelist
- Request body size limits (10KB)
- Session cookies: HttpOnly, SameSite=Lax, Secure in production
- Passwords hashed with bcrypt (cost 12)
- SQL injection protected by Drizzle ORM parameterized queries
- All user inputs validated with Zod before processing

## Development

```bash
# Start API server
pnpm --filter @workspace/api-server run dev

# Start frontend
pnpm --filter @workspace/forum run dev

# Push DB schema changes
pnpm --filter @workspace/db run push

# Regenerate API client from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen
```

## Local Testing

The site runs at http://localhost:80 through the Replit proxy.
API routes: /api/...
Frontend: /

## Environment Variables

See `config/sso-and-email.env` for all required credentials.
DATABASE_URL is auto-provisioned by Replit.
SESSION_SECRET must be set to a secure random string.
