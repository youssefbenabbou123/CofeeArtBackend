# Railway Blog Setup - Quick Guide

## Step 1: Run the Database Migration

Run this command to add the blog columns to your Railway database:

```bash
cd backend
npm run setup-blogs
```

This will:
- Connect to your Railway database (using DATABASE_URL)
- Add all required columns (author, category, excerpt, slug, published, updated_at)
- Create indexes for performance
- Verify the setup

## Step 2: Verify It Works

1. Start your backend server:
   ```bash
   npm run dev
   ```

2. Go to your admin panel: `/admin/blogs`

3. Click "Nouveau blog" and create a blog

4. The blog will be **saved directly to your Railway database**

## How It Works

- All blog operations use `pool.query()` which connects to your Railway database
- When you create/edit/delete a blog in the admin panel, it saves to Railway automatically
- The `DATABASE_URL` environment variable in Railway connects everything

## Troubleshooting

If you get errors:
1. Make sure `DATABASE_URL` is set in Railway environment variables
2. Make sure your Railway PostgreSQL service is running
3. Check the backend logs for any database connection errors

