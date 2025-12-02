# Admin Setup Guide

## How to Create an Admin User

### Option 1: Using the Script (Recommended)

Run this command in the `backend` directory:

```bash
npm run create-admin
```

This will create an admin user with:
- **Email**: `admin@coffeearts.fr`
- **Password**: `admin123`

### Option 2: Custom Admin User

You can specify custom credentials:

```bash
npm run create-admin your-email@example.com your-password "Your Name"
```

### Option 3: Update Existing User to Admin

If you already have a user account, you can make them admin:

```bash
npm run create-admin your-existing-email@example.com
```

This will update the existing user's role to `admin` without changing their password.

## How to Login as Admin

1. Go to `/connexion` on your website
2. Enter your admin email and password
3. You will be automatically redirected to `/admin` after login

## Troubleshooting

### "I'm logged out after refresh"

The JWT token is stored in `localStorage`. Make sure:
- Your browser allows localStorage
- You're not in incognito/private mode
- The backend API is running and accessible
- Check browser console for any errors

### "I can't access /admin"

Make sure:
- Your user has `role = 'admin'` in the database
- You're logged in (check if token exists in localStorage)
- The backend is running on the correct port (default: 3001)

### Check if User is Admin

You can check in your database:

```sql
SELECT email, role FROM users WHERE email = 'your-email@example.com';
```

The role should be `'admin'` (not `'client'`).

