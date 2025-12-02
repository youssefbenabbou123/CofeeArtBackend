# Quick Setup Guide

## Step 1: Create .env file

Create a `.env` file in the `backend` directory with the following content:

```
DATABASE_URL=postgresql://postgres:KoWGcJSzhFeFBLgXabaQnDwrUbrnPRzg@maglev.proxy.rlwy.net:35377/railway
PORT=3002
NODE_ENV=development
JWT_SECRET=your-secret-key-change-in-production

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

## Step 2: Install dependencies

```bash
cd backend
npm install
```

## Step 3: Start the server

```bash
npm run dev
```

## Step 4: Test the connection

Open your browser or use curl:
- Health check: http://localhost:3001/
- Database test: http://localhost:3001/test-db

You should see a JSON response with the current database timestamp if everything is working correctly.

