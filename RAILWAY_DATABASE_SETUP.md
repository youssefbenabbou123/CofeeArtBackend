# Railway Database Setup Guide

## Problem
Getting 500 errors because the backend is trying to connect to `127.0.0.1:5432` (localhost) instead of Railway Postgres.

## Solution: Configure DATABASE_URL in Railway

### Step 1: Get Your Railway Database URL

1. **Go to Railway Dashboard**
   - Navigate to [railway.app](https://railway.app)
   - Select your **PostgreSQL** service (not your backend service)

2. **Copy the Connection String**
   - Go to the **Variables** tab
   - Look for `DATABASE_URL` or `POSTGRES_URL`
   - **OR** go to the **Connect** tab and copy the connection string
   - It should look like:
     ```
     postgresql://postgres:password@postgres.railway.internal:5432/railway
     ```
     or
     ```
     postgresql://postgres:password@maglev.proxy.rlwy.net:35377/railway
     ```

### Step 2: Set DATABASE_URL in Your Backend Service

1. **In Railway Dashboard:**
   - Select your **Backend** service (the Node.js/Express service)
   - Go to **Variables** tab
   - Click **+ New Variable**
   - Add:
     - **Name:** `DATABASE_URL`
     - **Value:** Paste the connection string from Step 1
     - Click **Add**

2. **Verify the Variable:**
   - Make sure `DATABASE_URL` is listed in your backend service variables
   - Railway will automatically redeploy your service when you add/update variables

### Step 3: Verify Connection

After Railway redeploys:

1. **Check Railway Logs:**
   - Go to your backend service → **Deployments** → Click latest deployment → **View Logs**
   - You should see:
     ```
     ✅ Connected to PostgreSQL database
     📍 Using Railway PostgreSQL
     🔒 SSL enabled for database connection (Railway/Production)
     ```

2. **Test the Database Endpoint:**
   - Visit: `https://your-backend-url.railway.app/test-db`
   - You should get a JSON response with database info

### Alternative: Using Individual Database Variables

If Railway doesn't provide `DATABASE_URL`, you can construct it from individual variables:

1. **Get these from your PostgreSQL service Variables tab:**
   - `PGHOST` (e.g., `postgres.railway.internal` or `maglev.proxy.rlwy.net`)
   - `PGPORT` (e.g., `5432` or `35377`)
   - `PGDATABASE` (usually `railway`)
   - `PGUSER` (usually `postgres`)
   - `PGPASSWORD` (the password)

2. **Construct DATABASE_URL:**
   ```
   postgresql://PGUSER:PGPASSWORD@PGHOST:PGPORT/PGDATABASE
   ```
   
   Example:
   ```
   postgresql://postgres:KoWGcJSzhFeFBLgXabaQnDwrUbrnPRzg@postgres.railway.internal:5432/railway
   ```

3. **Set in Backend Service:**
   - Add `DATABASE_URL` with the constructed string

## Local Development Setup

For local development, create a `.env` file in the `backend` directory:

```env
# Use your Railway database URL (works from localhost too)
DATABASE_URL=postgresql://postgres:password@maglev.proxy.rlwy.net:35377/railway

# Or use a local PostgreSQL if you have one
# DATABASE_URL=postgresql://postgres:password@localhost:5432/coffeearts

PORT=3002
NODE_ENV=development
JWT_SECRET=your-secret-key-change-in-production

# Cloudinary Configuration (if needed)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

## Troubleshooting

### Issue 1: "DATABASE_URL environment variable is not set!"
**Solution:** Make sure `DATABASE_URL` is set in your Railway backend service variables.

### Issue 2: "Connection refused" or "ECONNREFUSED"
**Solution:** 
- Verify the `DATABASE_URL` is correct
- Check that your PostgreSQL service is running in Railway
- Ensure the host/port in the URL are correct

### Issue 3: "SSL required" error
**Solution:** The code automatically enables SSL for Railway. If you see this error, check:
- Your `DATABASE_URL` includes the correct host
- Railway PostgreSQL service is running

### Issue 4: "password authentication failed"
**Solution:**
- Verify the password in `DATABASE_URL` matches the one in Railway
- Check if the password has special characters that need URL encoding
- Regenerate the password in Railway if needed

## Testing the Connection

1. **Via Railway Logs:**
   - Check deployment logs for connection messages

2. **Via API Endpoint:**
   - `GET https://your-backend.railway.app/test-db`
   - Should return: `{ "success": true, "message": "Database connection successful", ... }`

3. **Via Local Test:**
   ```bash
   cd backend
   npm run dev
   # Check console for: "✅ Connected to PostgreSQL database"
   ```

## Important Notes

- ✅ **SSL is automatically enabled** for Railway connections
- ✅ **No hardcoded localhost** - everything uses `DATABASE_URL`
- ✅ **Works for both local and Railway** - automatically detects environment
- ⚠️ **Never commit `.env` files** to git
- ⚠️ **Keep your DATABASE_URL secret** - it contains your database password

## Next Steps

After setting up `DATABASE_URL`:
1. ✅ Railway will automatically redeploy your backend
2. ✅ Check logs to verify connection
3. ✅ Test login/signup from your Vercel frontend
4. ✅ The 500 errors should be resolved!

