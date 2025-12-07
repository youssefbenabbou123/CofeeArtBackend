# Debug: Database Connection to Localhost

## Problem
Even though you set `DATABASE_URL` in Railway, it's still trying to connect to `127.0.0.1:5432` (localhost).

## Diagnostic Steps

### Step 1: Check Railway Logs

After the code update, Railway logs will now show:
- The masked DATABASE_URL value
- Whether it contains "railway" 
- Whether it's pointing to localhost

**Look for these lines in Railway logs:**
```
🔍 Database Configuration:
- DATABASE_URL: Set ✅
- DATABASE_URL (masked): postgresql://postgres:****@...
```

### Step 2: Verify DATABASE_URL Value

**Common Issues:**

1. **DATABASE_URL points to localhost:**
   - ❌ `postgresql://postgres:pass@localhost:5432/db`
   - ❌ `postgresql://postgres:pass@127.0.0.1:5432/db`
   - ✅ `postgresql://postgres:pass@containers-us-west-xxx.railway.app:5432/railway`
   - ✅ `postgresql://postgres:pass@maglev.proxy.rlwy.net:35377/railway`

2. **DATABASE_URL is in wrong service:**
   - Must be in **Backend service** (Node.js)
   - NOT in PostgreSQL service (that's just the source)

3. **DATABASE_URL is empty or has extra spaces:**
   - Check for leading/trailing spaces
   - Make sure it's the full connection string

### Step 3: Check Railway Variables

1. **Go to Railway Dashboard**
2. **Click your Backend service** (Node.js/Express)
3. **Go to Variables tab**
4. **Verify:**
   - `DATABASE_URL` exists
   - Value starts with `postgresql://`
   - Value contains `railway` in the hostname (not `localhost`)

### Step 4: Force Redeploy

Sometimes Railway doesn't pick up variable changes:

1. **Go to your Backend service**
2. **Click "Settings"**
3. **Scroll to "Redeploy" section**
4. **Click "Redeploy"**

Or trigger a new deployment by:
- Making a small code change and pushing
- Or manually redeploy from the Deployments tab

### Step 5: Check for .env File Conflicts

If you have a `.env` file in your backend directory that's being committed to git, it might override Railway variables.

**Check:**
```bash
# In your backend directory
cat .env
```

**If it contains DATABASE_URL pointing to localhost:**
- Either remove it (Railway will use its own variables)
- Or make sure `.env` is in `.gitignore`

## What the Updated Code Does

The updated `db.js` will now:
1. ✅ Show masked DATABASE_URL in logs (so you can verify it)
2. ✅ Warn if DATABASE_URL contains "localhost"
3. ✅ Confirm if DATABASE_URL contains "railway"
4. ✅ Show all environment variables for debugging

## Expected Log Output (Success)

```
🔍 Database Configuration:
- DATABASE_URL: Set ✅
- DATABASE_URL (masked): postgresql://postgres:****@containers-us-west-xxx.railway.app:5432/railway...
✅ DATABASE_URL contains "railway" - looks correct
- Environment: Production
- Platform: Railway
- NODE_ENV: production
- RAILWAY_ENVIRONMENT: production
🔒 SSL enabled for database connection (Railway/Production)
✅ Connected to PostgreSQL database
📍 Using Railway PostgreSQL
```

## Expected Log Output (Problem)

```
🔍 Database Configuration:
- DATABASE_URL: Set ✅
- DATABASE_URL (masked): postgresql://postgres:****@localhost:5432/db...
⚠️  WARNING: DATABASE_URL appears to point to localhost!
   This will not work on Railway. Use the Railway PostgreSQL connection string.
```

## Quick Fix Checklist

- [ ] DATABASE_URL is in **Backend service** (not PostgreSQL service)
- [ ] DATABASE_URL value contains `railway` in hostname
- [ ] DATABASE_URL does NOT contain `localhost` or `127.0.0.1`
- [ ] Railway has redeployed after setting the variable
- [ ] Check logs to see what DATABASE_URL value is actually being used

## Still Not Working?

1. **Copy the exact DATABASE_URL from PostgreSQL service Variables tab**
2. **Delete the DATABASE_URL variable from Backend service**
3. **Add it again with the fresh value**
4. **Redeploy manually**
5. **Check logs for the masked DATABASE_URL value**

The logs will now show you exactly what DATABASE_URL value is being used, which will help identify the problem.

