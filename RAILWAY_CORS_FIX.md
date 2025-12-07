# Railway CORS Fix

## Problem
Railway is returning `Access-Control-Allow-Origin: https://railway.com` instead of your Vercel domain, causing CORS errors.

## Solution 1: Update Code (Already Done)
The code has been updated to set CORS headers explicitly. Make sure you:
1. Commit and push the updated `server.js`
2. Wait for Railway to redeploy
3. Test again

## Solution 2: Check Railway Settings

Railway might have proxy settings that override CORS. Check:

1. **Go to Railway Dashboard**
2. **Select your Backend service**
3. **Go to Settings tab**
4. **Look for:**
   - "Public Domain" settings
   - "Proxy" settings
   - "Headers" or "CORS" settings
5. **If you see any CORS/proxy settings, disable them** or configure them to allow your Vercel domain

## Solution 3: Use Railway Environment Variables

Railway might respect certain environment variables. Try adding to your Backend service:

```
ALLOWED_ORIGINS=https://my-project-mqxfmghrv-lhehlolbro123-2933s-projects.vercel.app,https://your-production-domain.vercel.app
```

## Solution 4: Test CORS Headers

After redeploying, test the CORS headers:

```bash
curl -H "Origin: https://my-project-mqxfmghrv-lhehlolbro123-2933s-projects.vercel.app" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://coffee-arts-backend.railway.app/api/auth/signin \
     -v
```

Look for:
```
Access-Control-Allow-Origin: https://my-project-mqxfmghrv-lhehlolbro123-2933s-projects.vercel.app
```

If you see `https://railway.com`, Railway is overriding it.

## Solution 5: Check Railway Logs

After redeploying, check Railway logs for:
```
🔍 Preflight request from: https://my-project-mqxfmghrv-lhehlolbro123-2933s-projects.vercel.app
✅ Preflight request handled, origin: ...
```

This confirms the code is running and handling CORS.

## If Still Not Working

If Railway continues to override CORS headers:

1. **Check Railway Documentation** for CORS/proxy settings
2. **Contact Railway Support** - they might have a setting to disable proxy CORS
3. **Alternative:** Use a custom domain on Railway (might bypass proxy)
4. **Alternative:** Deploy backend to a different platform (Render, Fly.io, etc.)

## Quick Test

After redeploying, test in browser console:

```javascript
fetch('https://coffee-arts-backend.railway.app/api/auth/signin', {
  method: 'OPTIONS',
  headers: {
    'Origin': 'https://my-project-mqxfmghrv-lhehlolbro123-2933s-projects.vercel.app'
  }
}).then(r => {
  console.log('CORS Headers:', r.headers.get('Access-Control-Allow-Origin'));
});
```

This will show what CORS header Railway is actually returning.

