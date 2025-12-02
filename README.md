# Coffee Arts Paris Backend API

A Node.js + Express backend server connected to PostgreSQL database on Railway.

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

## Setup Instructions

1. **Install Dependencies**

   ```bash
   cd backend
   npm install
   ```

2. **Configure Environment Variables**

   Copy the `.env.example` file to `.env`:
   
   ```bash
   cp .env.example .env
   ```

   The `.env` file is already configured with your database connection string. Make sure it contains:
   
   ```
   DATABASE_URL=postgresql://postgres:KoWGcJSzhFeFBLgXabaQnDwrUbrnPRzg@maglev.proxy.rlwy.net:35377/railway
   PORT=3001
   NODE_ENV=development
   ```

3. **Start the Server**

   For development (with auto-reload):
   ```bash
   npm run dev
   ```

   For production:
   ```bash
   npm start
   ```

   The server will start on `http://localhost:3001` (or the PORT specified in `.env`).

## API Endpoints

### Health Check
- **GET** `/`
  - Returns server status and timestamp

### Database Test
- **GET** `/test-db`
  - Tests the database connection
  - Returns the current database timestamp

## Project Structure

```
backend/
├── server.js          # Main Express server
├── db.js              # PostgreSQL connection pool
├── package.json       # Dependencies and scripts
├── .env              # Environment variables (not in git)
├── .env.example      # Example environment variables
└── README.md         # This file
```

## Database Connection

The backend uses `pg` (node-postgres) with a connection pool. SSL is enabled for Railway PostgreSQL connections.

## Next Steps

This backend is ready for you to add:
- Product routes (`/api/products`)
- Order routes (`/api/orders`)
- Workshop routes (`/api/workshops`)
- Reservation routes (`/api/reservations`)
- Authentication middleware
- Additional business logic

## Deployment

When deploying to production:
1. Set `NODE_ENV=production` in your environment variables
2. Ensure `DATABASE_URL` is set in your hosting platform's environment variables
3. The server will automatically use the `PORT` environment variable provided by your hosting platform

