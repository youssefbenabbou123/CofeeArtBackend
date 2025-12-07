# Quick Fix: Railway DATABASE_URL Setup

## The Error You're Seeing

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

This means your backend is trying to connect to localhost PostgreSQL instead of Railway PostgreSQL.

## ✅ Quick Fix (2 Minutes)

### Step 1: Get Your Database URL from Railway

1. **Open Railway Dashboard:** https://railway.app
2. **Click on your PostgreSQL service** (not your backend service)
3. **Go to the "Variables" tab**
4. **Find `DATABASE_URL`** or `POSTGRES_URL`
5. **Click the copy icon** to copy the full connection string

   It should look like:
   ```
   postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway
   ```
   or
   ```
   postgresql://postgres:password@maglev.proxy.rlwy.net:35377/railway
   ```

### Step 2: Add DATABASE_URL to Your Backend Service

1. **In Railway Dashboard, click on your Backend service** (Node.js/Express)
2. **Go to the "Variables" tab**
3. **Click "+ New Variable"**
4. **Enter:**
   - **Name:** `DATABASE_URL`
   - **Value:** Paste the connection string you copied in Step 1
5. **Click "Add"**

### Step 3: Wait for Redeploy

- Railway will **automatically redeploy** your backend
- Watch the logs - you should see:
  ```
  🔍 Database Configuration:
  - DATABASE_URL: Set ✅
  - Environment: Production
  - Platform: Railway
  🔒 SSL enabled for database connection (Railway/Production)
  ✅ Connected to PostgreSQL database
  📍 Using Railway PostgreSQL
  ```

## ✅ Verify It's Working

1. **Check Railway Logs:**
   - Go to your Backend service → Latest deployment → Logs
   - Look for: "✅ Connected to PostgreSQL database"

2. **Test the API:**
   - Visit: `https://your-backend.railway.app/test-db`
   - Should return: `{ "success": true, ... }`

3. **Test Login:**
   - Try signing in from your Vercel frontend
   - Should work without 500 errors!

## ❌ If You Still See Errors

### Error: "DATABASE_URL environment variable is not set!"

**Solution:** Make sure you added `DATABASE_URL` to your **Backend service** (not the PostgreSQL service). The variable needs to be in the service that runs your Node.js code.

### Error: Still connecting to 127.0.0.1:5432

**Solution:** 
1. Double-check the `DATABASE_URL` value in your Backend service variables
2. Make sure it's the full connection string from PostgreSQL service
3. Verify Railway redeployed after adding the variable
4. Check the logs to see what DATABASE_URL value is being used

### Error: "password authentication failed"

**Solution:**
- The DATABASE_URL might be outdated
- Go back to PostgreSQL service → Variables → Copy fresh DATABASE_URL
- Update it in your Backend service

## 📝 Important Notes

- ✅ `DATABASE_URL` must be in your **Backend service** variables
- ✅ Copy it from your **PostgreSQL service** variables
- ✅ Railway auto-redeploys when you add/update variables
- ✅ The connection string should start with `postgresql://`
- ✅ No need to modify any code - just set the environment variable!

## 🎯 That's It!

Once `DATABASE_URL` is set in your Backend service, Railway will redeploy and your backend will connect to Railway PostgreSQL instead of localhost.

