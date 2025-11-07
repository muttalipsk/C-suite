# Quick Fix Checklist for Azure VM

## Problem Summary

You're experiencing two issues:
1. **Gemini API errors** - "API Key not found"
2. **401 Unauthorized errors** - After login, session doesn't persist

## Solution: Update & Rebuild

Run these commands on your Azure VM:

```bash
# 1. Navigate to project directory
cd /home/digitaltwin/ask-the-expert

# 2. Pull latest code (if using git)
git pull

# OR if not using git, manually update these files:
# - server/index.ts (environment variables passed to Python)
# - server/routes.ts (session cookie fix + session.save() callbacks)
# - constants.py (API key debugging)
# - pre_meeting.py (better error logging)

# 3. Install/update dependencies
npm install

# 4. Rebuild TypeScript to JavaScript
npm run build

# 5. Update PM2 ecosystem config
nano ecosystem.config.js
```

## Required Environment Variables in ecosystem.config.js

```javascript
module.exports = {
  apps: [{
    name: 'ask-expert-node',
    script: 'dist/index.js',
    cwd: '/home/digitaltwin/ask-the-expert',
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
      
      // ⚠️ CRITICAL: Add your actual Gemini API key here
      GEMINI_API_KEY: 'AIzaSy...',  // Replace with your actual key
      
      // ⚠️ CRITICAL: Set to false for HTTP deployments
      COOKIE_SECURE: 'false',  // Only set to 'true' if using HTTPS
      
      SESSION_SECRET: 'your-random-secret-here',
      DATABASE_URL: 'postgresql://digitaltwin_user:Digitaltwin@123@localhost:5432/digitaltwin',
      PGHOST: 'localhost',
      PGPORT: '5432',
      PGUSER: 'digitaltwin_user',
      PGPASSWORD: 'Digitaltwin@123',
      PGDATABASE: 'digitaltwin'
    },
    error_file: './logs/node-error.log',
    out_file: './logs/node-out.log',
    time: true
  }]
};
```

## Restart PM2

```bash
# Delete existing PM2 process
pm2 delete ask-expert-node

# Start with ecosystem config
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Enable PM2 startup on boot
pm2 startup
# (Follow the command it outputs)

# Check logs
pm2 logs ask-expert-node --lines 50
```

## Verify the Fixes

### 1. Check for API Key Debug Message

In PM2 logs, you should see:
```
[DEBUG] GEMINI_API_KEY loaded: AIzaSyB6Y9...zq1c
✓ Gemini API configured successfully
```

### 2. Test Login Flow

1. Open browser: http://20.244.25.157
2. Login with existing account or create new account
3. After login, you should be redirected to dashboard
4. **NO 401 errors should appear in browser console**
5. Try creating a new meeting - should work without errors

### 3. Check PM2 Logs

```bash
# Should NOT see these errors:
❌ "API Key not found"
❌ "401 Unauthorized" after successful login

# Should see these:
✓ "POST /api/auth/login 200"
✓ "GET /api/auth/me 200" (or 304)
✓ "POST /api/pre-meeting/init 200"
```

## What Changed

### Fix 1: Session Cookie Configuration
**Before:**
```typescript
secure: process.env.NODE_ENV === "production"  // Always true in production
```

**After:**
```typescript
secure: process.env.COOKIE_SECURE === "true"  // Only true if explicitly set
sameSite: "lax"  // Added for better cookie handling
```

**Why**: Secure cookies only work over HTTPS. Since you're using HTTP (IP address), the browser was blocking the session cookie.

### Fix 2: Session Save Callbacks
**Before:**
```typescript
req.session.userId = user.id;
res.json({ ... });  // Response sent before session saved
```

**After:**
```typescript
req.session.userId = user.id;
req.session.save((err) => {
  if (err) return res.status(500).json({ error: "Session save failed" });
  res.json({ ... });  // Response sent after session saved
});
```

**Why**: Prevents race condition where next request arrives before session is saved to database.

### Fix 3: Environment Variable Passing to Python
**Before:**
```typescript
spawn("python3", [...], {
  cwd: process.cwd(),
  // No env specified
})
```

**After:**
```typescript
spawn("python3", [...], {
  cwd: process.cwd(),
  env: process.env  // Pass all environment variables
})
```

**Why**: Python server wasn't receiving GEMINI_API_KEY environment variable.

## Troubleshooting

### Still getting 401 errors?

1. **Clear browser cookies**:
   - Press F12 → Application/Storage tab → Cookies → Delete all
   - Refresh page and login again

2. **Check cookie is being set**:
   - F12 → Network tab → Click login request → Response Headers
   - Should see: `Set-Cookie: connect.sid=...`

3. **Verify COOKIE_SECURE=false**:
   ```bash
   pm2 env 0 | grep COOKIE_SECURE
   # Should show: COOKIE_SECURE=false
   ```

### Still getting Gemini API errors?

1. **Run diagnostic test**:
   ```bash
   cd /home/digitaltwin/ask-the-expert
   python3 test_gemini_api.py
   ```

2. **Check API key in logs**:
   ```bash
   pm2 logs ask-expert-node | grep "GEMINI_API_KEY"
   ```

3. **Verify API key is valid**:
   - Go to: https://aistudio.google.com/app/apikey
   - Check if Generative Language API is enabled
   - Create new key if needed

## Expected Timeline

- Pulling code: 10 seconds
- Building: 30-60 seconds
- PM2 restart: 5 seconds
- **Total: ~2 minutes**

## Success Indicators

✅ No errors in PM2 logs
✅ Login works and redirects to dashboard
✅ No 401 errors in browser console
✅ Pre-meeting conversations work
✅ Can create personas and chat with advisors

If all checks pass, your application is fully functional! 🎉
