# Deployment Checklist

## Backend Deployment (Vercel)

### Environment Variables Required in Vercel:

1. **STRIPE_SECRET_KEY**
   - Value: Your Stripe secret key (starts with `sk_test_` or `sk_live_`)
   - Get it from: https://dashboard.stripe.com/apikeys
   - Environment: Production, Preview, Development

2. **DATABASE_URL** (if using database)
   - Value: Your database connection string
   - Environment: Production, Preview, Development

3. **FRONTEND_URL** (optional, for CORS)
   - Value: Your frontend Vercel URL
   - Example: `https://your-frontend.vercel.app`
   - Environment: Production, Preview, Development

4. **JWT_SECRET** (for authentication)
   - Value: A random secret string for JWT tokens
   - Environment: Production, Preview, Development

5. **CLOUDINARY_CLOUD_NAME** (if using Cloudinary)
   - Value: Your Cloudinary cloud name
   - Environment: Production, Preview, Development

6. **CLOUDINARY_API_KEY** (if using Cloudinary)
   - Value: Your Cloudinary API key
   - Environment: Production, Preview, Development

7. **CLOUDINARY_API_SECRET** (if using Cloudinary)
   - Value: Your Cloudinary API secret
   - Environment: Production, Preview, Development

## Frontend Deployment (Vercel)

### Environment Variables Required in Vercel:

1. **NEXT_PUBLIC_API_URL**
   - Value: Your backend Vercel URL
   - Example: `https://your-backend.vercel.app`
   - Environment: Production, Preview, Development

2. **NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY**
   - Value: Your Stripe publishable key (starts with `pk_test_` or `pk_live_`)
   - Get it from: https://dashboard.stripe.com/apikeys
   - Environment: Production, Preview, Development

## Important Notes

- **Never commit secrets to Git** - Always use environment variables
- **STRIPE_CONFIG.md is in .gitignore** - Do not commit it
- All `.env` files are in `.gitignore` - Keep secrets local only
- After adding environment variables in Vercel, it will auto-redeploy

## Verification After Deployment

1. **Backend Health Check:**
   ```
   GET https://your-backend.vercel.app/
   ```

2. **Stripe Configuration Check:**
   ```
   GET https://your-backend.vercel.app/api/stripe/check-config
   ```

3. **Database Connection:**
   ```
   GET https://your-backend.vercel.app/test-db
   ```


