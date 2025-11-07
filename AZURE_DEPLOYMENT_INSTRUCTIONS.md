# Azure VM Deployment Instructions

## Issue: Gemini API Key Not Found

The error `API Key not found. Please pass a valid API key` occurs when the Python server doesn't have access to the `GEMINI_API_KEY` environment variable.

## Quick Fix

### Option 1: Set Environment Variables in PM2 Ecosystem File (Recommended)

1. **Edit the ecosystem.config.js file** on your Azure VM:

```bash
nano /home/digitaltwin/ask-the-expert/ecosystem.config.js
```

2. **Add your environment variables** in the `env` section:

```javascript
module.exports = {
  apps: [{
    name: 'ask-expert-node',
    script: 'dist/index.js',
    cwd: '/home/digitaltwin/ask-the-expert',
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
      GEMINI_API_KEY: 'YOUR_ACTUAL_GEMINI_API_KEY_HERE',
      DATABASE_URL: 'postgresql://user:password@localhost:5432/digitaltwin',
      SESSION_SECRET: 'your-session-secret-here',
      PGHOST: 'localhost',
      PGPORT: '5432',
      PGUSER: 'digitaltwin_user',
      PGPASSWORD: 'Digitaltwin@123',
      PGDATABASE: 'digitaltwin'
    }
  }]
};
```

3. **Restart PM2 with the new configuration**:

```bash
cd /home/digitaltwin/ask-the-expert
pm2 delete ask-expert-node
pm2 start ecosystem.config.js
pm2 save
```

### Option 2: Set Environment Variables in .env File

1. **Create a .env file** in your project root:

```bash
cd /home/digitaltwin/ask-the-expert
nano .env
```

2. **Add your environment variables**:

```env
GEMINI_API_KEY=YOUR_ACTUAL_GEMINI_API_KEY_HERE
DATABASE_URL=postgresql://digitaltwin_user:Digitaltwin@123@localhost:5432/digitaltwin
SESSION_SECRET=your-session-secret-here
PGHOST=localhost
PGPORT=5432
PGUSER=digitaltwin_user
PGPASSWORD=Digitaltwin@123
PGDATABASE=digitaltwin
NODE_ENV=production
```

3. **Install dotenv** (if not already installed):

```bash
npm install dotenv
```

4. **Load .env in your application** (already done in the codebase)

5. **Restart PM2**:

```bash
pm2 restart ask-expert-node
```

### Option 3: Set System-Wide Environment Variables

1. **Edit your bash profile**:

```bash
nano ~/.bashrc
```

2. **Add at the end**:

```bash
export GEMINI_API_KEY="YOUR_ACTUAL_GEMINI_API_KEY_HERE"
export DATABASE_URL="postgresql://digitaltwin_user:Digitaltwin@123@localhost:5432/digitaltwin"
export SESSION_SECRET="your-session-secret-here"
```

3. **Reload the profile**:

```bash
source ~/.bashrc
```

4. **Restart PM2**:

```bash
pm2 restart ask-expert-node
```

## Verify the Fix

### Step 1: Run the Diagnostic Test

```bash
cd /home/digitaltwin/ask-the-expert
python3 test_gemini_api.py
```

If this succeeds, your environment variables are set correctly!

### Step 2: Check PM2 Logs

```bash
pm2 logs ask-expert-node --lines 50
```

You should see:
- `[DEBUG] GEMINI_API_KEY loaded: AIzaSy...xxxx` (showing first 10 and last 4 characters)
- `✓ Gemini API configured successfully`
- NO errors about "API Key not found"

### Step 3: Check PM2 Environment Variables

```bash
pm2 env 0
```

Verify that `GEMINI_API_KEY` is listed in the environment variables.

## Troubleshooting

### Error: "API Key not found"

**Cause**: Environment variable not being passed to the Node.js/Python process

**Fix**: Use Option 1 (ecosystem.config.js) which explicitly sets environment variables for PM2

### Error: "GEMINI_API_KEY is empty"

**Cause**: The API key is set but contains an empty string

**Fix**: Check your API key value - remove quotes, spaces, or newlines

### Error: "API key is invalid"

**Cause**: The API key format is incorrect or the key has been revoked

**Fix**: 
1. Go to https://aistudio.google.com/app/apikey
2. Create a new API key
3. Make sure the Generative Language API is enabled
4. Update your environment variable with the new key

## Important Notes

1. **Never commit API keys to Git** - Use .gitignore to exclude .env and ecosystem.config.js if they contain secrets

2. **PM2 needs to be restarted** after changing environment variables

3. **Check API key permissions** - Ensure the Generative Language API is enabled in your Google Cloud project

4. **API key format** - Should start with `AIza` and be about 39 characters long

## After Fixing

Once you've set up the environment variables correctly:

1. Delete the PM2 process: `pm2 delete ask-expert-node`
2. Start with ecosystem file: `pm2 start ecosystem.config.js`
3. Save PM2 configuration: `pm2 save`
4. Set PM2 to start on boot: `pm2 startup`

Your application should now work correctly with the Gemini API!
