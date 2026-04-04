# Test Credentials for Offline Development

This document contains hardcoded test credentials automatically seeded into the offline/development database for testing the Scootware Forum.

## Admin Account

Use this account to test admin features, moderation tools, and site configuration.

| Field | Value |
|-------|-------|
| **Username** | `local-admin` |
| **Password** | `localadmin123` |
| **Email** | `local-admin@scootware.test` |
| **Role** | Admin |
| **Verified** | ✅ Yes |

### Admin Capabilities
- Access admin dashboard
- Create/manage categories and subforums
- Moderate posts and users
- Manage user roles and permissions
- View site analytics and health

## Standard User Account

Use this account to test regular user features like posting, replying, and profile management.

| Field | Value |
|-------|-------|
| **Username** | `testuser` |
| **Password** | `testuser123` |
| **Email** | `testuser@scootware.test` |
| **Role** | User |
| **Verified** | ✅ Yes |

### User Capabilities
- Create threads and posts
- Reply to existing threads
- Edit/delete own posts
- Manage own profile
- Upload avatar
- Participate in shoutbox

## Database Information

- **Database Type**: PGlite (in-memory, offline mode)
- **Data Persistence**: Not persisted across application restarts
- **Reset**: Restart the application to reset to fresh test data
- **Environment Variables**: 
  - `LOCAL_ADMIN_USERNAME`
  - `LOCAL_ADMIN_PASSWORD`
  - `LOCAL_ADMIN_EMAIL`
  - `LOCAL_USER_USERNAME`
  - `LOCAL_USER_PASSWORD`
  - `LOCAL_USER_EMAIL`

## Testing Workflow

1. **Start the application** - Credentials are automatically seeded
2. **Log in with either account** above
3. **Test features** appropriate to the role
4. **Clear data** by restarting the application

## Notes

- These credentials are **hardcoded for offline testing only**
- Do **NOT** use in production
- Passwords are pre-hashed with bcrypt (salt rounds: 12)
- Both accounts have email verification enabled by default
- Standard user has "basic" upgrade type enabled for testing upgraded features

## Customization

To use different credentials, set environment variables before starting:

```bash
# For admin
export LOCAL_ADMIN_USERNAME="admin"
export LOCAL_ADMIN_PASSWORD="myadminpass"
export LOCAL_ADMIN_EMAIL="admin@example.com"

# For user
export LOCAL_USER_USERNAME="user"
export LOCAL_USER_PASSWORD="myuserpass"
export LOCAL_USER_EMAIL="user@example.com"
```

Password hashes can also be overridden:
- `LOCAL_ADMIN_PASSWORD_HASH` - bcrypt-hashed admin password
- `LOCAL_USER_PASSWORD_HASH` - bcrypt-hashed user password
