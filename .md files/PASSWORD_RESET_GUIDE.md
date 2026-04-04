# How to Test Password Reset for Your Account

## Current Status

✅ **Admin Password Reset Bypass**: Deployed and working  
✅ **Email Service**: Resend SMTP configured and operational  
✅ **Local Admin Account**: Working (local-admin / localadmin123)  
⚠️ **Your Personal Account**: Database resets on server restart  

---

## Steps to Recover Your Account

### Option 1: Use Password Reset (Recommended)

If you remember the email for your account:

1. **Go to login page**
   - Visit: https://scootware.us/

2. **Click "Forgot Password"**

3. **Enter your email address**
   - This sends a password reset email

4. **Check your email**
   - Look for email from: forum-administrator@scootware.us
   - Subject: "Reset your Scootware password"

5. **Click the reset link**
   - Link format: `https://scootware.us/reset-password?token=abc123...`

6. **Create a new password**
   - Use a strong password (min 8 characters)

7. **Login with new password**
   - Now you can access your account

---

## Troubleshooting

### Email Not Arriving

**Wait 1-2 minutes** - Email delivery can take a few seconds

**Check spam/junk folder** - Sometimes ends up there

**If still not there**:
1. Login as admin (local-admin / localadmin123)
2. Use admin dashboard to reset your password directly
3. Or provide your email to admin for manual password reset

### Don't Remember Your Email

Contact an admin account holder:
- **Admin Account**: local-admin@scootware.test
- **Password**: localadmin123 (current session)

Admin can:
1. Look up your account
2. Request password reset on your behalf
3. Or manually set a temporary password

### Account Doesn't Exist Anymore

This happens because the database is in-memory and resets on server restart.

**Solution**:
1. Register a new account with your email
2. You'll get a verification email
3. Verify your email address
4. Account is ready to use

---

## If You Want to Test Right Now

### Using Test Account

```
Email: testuser@scootware.test
Password: testuser123
```

This account always works because it's re-seeded on each restart.

### Using Admin Password Reset Bypass

1. SSH to server or ask admin for help
2. Request password reset for your account
3. Use the admin bypass to accept expired tokens
4. Set a new password
5. Login immediately

---

## What to Provide

If you need help, provide:

1. **Your email address** (for account lookup)
2. **Your username** (if you remember it)
3. **Date you created the account** (approximate)

Admin can then:
- Reset your password
- Unlock your account
- Transfer account data
- Create a new account with your email

---

## Security Reminder

- **Never share your password** with admins
- **Password resets are safe** - they verify it's you via email
- **Tokens expire** for non-admin accounts (24 hours)
- **Admin tokens don't expire** (by design, for emergency access)

---

## Quick Reference

| Task | How |
|------|-----|
| Reset my password | Go to login, click "Forgot Password" |
| Check email status | Look in INBOX and SPAM folders |
| Create new account | Visit login page, click "Sign Up" |
| Contact admin | Use admin portal at /admin |
| Check password status | Login to see if it works |

---

**Ready to proceed?** Try the password reset now! ✉️
