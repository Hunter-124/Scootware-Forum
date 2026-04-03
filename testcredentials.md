# Scootware Forum - Credentials & Configuration

## Database

**PostgreSQL (Production)**
- Host: 127.0.0.1
- Port: 5432
- Username: postgres
- Password: `[POSTGRES_PASSWORD]`
- Database: scootware
- Full URL: `postgresql://postgres:[POSTGRES_PASSWORD]@127.0.0.1:5432/scootware`

**Note:** For local development, `.env.local` can use an alternative connection:
- Old local creds (if needed): `postgres://scootadmin:${POSTGRES_PASSWORD}@localhost:5432/scootware`

---

## Session & Security

**SESSION_SECRET** (for session management)
```
e4a2d8b1c5f903e7a682b4d9c0e51f8a72b6d4c1a9f0e3b8d7c2a5f1e0b9d6c4
```

---

## OAuth & Third-Party APIs

### Discord OAuth
- **Client ID:** 1487692664643256420
- **Client Secret:** `T0dPpRUJxTdu92rwb59aeaK6qcnSlu8a`
- **Callback URL:** https://scootware.us/api/auth/sso/discord/callback

### Steam OpenID
- **API Key:** `AE4EADB8217450B5CD8182F7F4E5AE6B`
- **Callback URL:** https://scootware.us/api/auth/sso/steam/callback

### Google OAuth 2.0
- **Client ID:** [YOUR_GOOGLE_CLIENT_ID]
- **Client Secret:** `[YOUR_GOOGLE_CLIENT_SECRET]`
- **Callback URL:** https://scootware.us/api/auth/sso/google/callback

---

## Blockchain & Payment APIs

### Etherscan (Ethereum)
- **API Key:** `4I23NVSUYPEBI415TWG44I66AE5YZRX2UT`
- **Purpose:** ERC-20 token verification, smart contract interaction

### Stripe (Payment Processing)
**Test Environment:**
- **Public Key:** `pk_test_XXX`
- **Secret Key:** `sk_test_XXX`
- **Webhook Secret:** `whsec_XXX`

**Production Environment:**
- **Public Key:** `pk_live_XXX`
- **Secret Key:** `sk_live_XXX`
- **Webhook Secret:** `whsec_XXX`

### PayPal (Payment Processing)
- **Test Secret:** `paypal_secret_XXX`
- **Production Secret:** `paypal_secret_PROD`

---

## Environment Files Location

- `.env` - Local development (primary)
- `.env.local` - Local overrides
- `.env.production` - Production deployment settings
- `config/sso-and-email.env` - Template for OAuth/email config
- `config/crypto-payments.env` - Blockchain payment config

---

## Service Ports

- **API Server:** 3000
- **Forum Frontend:** 80 (via nginx reverse proxy)
- **PostgreSQL:** 5432
- **Redis:** 6379
- **MariaDB:** 3306

---

## Important Notes

⚠️ **Security Warning:** These credentials should NEVER be committed to version control or shared publicly.
- Stripe keys marked as "XXX" are placeholders and need to be filled in with real values
- PayPal production secret should be kept secure
- All API keys should be rotated regularly

---

Last Updated: 2026-04-02
