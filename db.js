import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Note: DATABASE_URL is no longer required since we migrated to MongoDB
// This file is kept for backward compatibility with migration scripts only
// If DATABASE_URL is not set, we simply don't create the pool
if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL not set - PostgreSQL connection will not be available');
  console.warn('   This is normal if you are using MongoDB (which is the default now)');
  console.warn('   DATABASE_URL is only needed for migration scripts');
}

// Determine if we're in production (Railway) or development
const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
const isRailway = !!process.env.RAILWAY_ENVIRONMENT || process.env.DATABASE_URL.includes('railway');

// Log DATABASE_URL info (masked for security)
const dbUrl = process.env.DATABASE_URL || '';
const maskedUrl = dbUrl ? dbUrl.replace(/:([^:@]+)@/, ':****@').substring(0, 100) + '...' : 'NOT SET';

console.log('🔍 Database Configuration:');
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? 'Set ✅' : 'Missing ❌');
if (process.env.DATABASE_URL) {
  console.log('- DATABASE_URL (masked):', maskedUrl);
  console.log('- Full DATABASE_URL host:', dbUrl.match(/@([^:]+)/)?.[1] || 'unknown');
  
  // Check if it's pointing to localhost
  if (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('::1')) {
    console.error('');
    console.error('⚠️  WARNING: DATABASE_URL appears to point to localhost!');
    console.error('   This will not work on Railway. Use the Railway PostgreSQL connection string.');
    console.error('   Expected: maglev.proxy.rlwy.net or containers-us-west-xxx.railway.app');
    console.error('');
  }
  // Check if it contains railway
  if (dbUrl.includes('railway') || dbUrl.includes('maglev.proxy.rlwy.net')) {
    console.log('✅ DATABASE_URL contains "railway" - looks correct');
  } else {
    console.warn('⚠️  DATABASE_URL does not contain "railway" - verify it\'s the Railway connection string');
  }
}
console.log('- Environment:', isProduction ? 'Production' : 'Development');
console.log('- Platform:', isRailway ? 'Railway' : 'Local');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('- RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT || 'not set');

// Only create pool if DATABASE_URL is set (for migration scripts)
let pool = null;

if (process.env.DATABASE_URL) {
  // Build connection configuration with SSL for Railway
  const poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Required for Railway PostgreSQL
    }
  };

  console.log('🔒 SSL enabled for database connection (required for Railway)');

  // Create a connection pool
  pool = new Pool(poolConfig);
} else {
  // Create a dummy pool object that throws errors when used
  pool = {
    query: () => {
      throw new Error('PostgreSQL pool not initialized. DATABASE_URL is required for PostgreSQL operations.');
    },
    connect: () => {
      throw new Error('PostgreSQL pool not initialized. DATABASE_URL is required for PostgreSQL operations.');
    },
    end: () => Promise.resolve()
  };
}

// Test the connection (only if pool was created)
if (pool && process.env.DATABASE_URL) {
  pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL database');
    if (isRailway) {
      console.log('📍 Using Railway PostgreSQL');
    }
  });

  pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  const dbUrl = process.env.DATABASE_URL || '';
  const maskedUrl = dbUrl ? dbUrl.replace(/:([^:@]+)@/, ':****@').substring(0, 100) + '...' : 'NOT SET';
  console.error('Database connection string:', dbUrl ? 'Set' : 'Missing!');
  if (dbUrl) {
    console.error('DATABASE_URL (masked):', maskedUrl);
  }
  if (err.code === 'ECONNREFUSED') {
    console.error('');
    console.error('⚠️  Connection refused - This usually means:');
    if (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('::1')) {
      console.error('   ❌ DATABASE_URL is pointing to localhost!');
      console.error('   ❌ You need to use the Railway PostgreSQL connection string.');
      console.error('');
      console.error('   To fix:');
      console.error('   1. Go to Railway → PostgreSQL service → Variables');
      console.error('   2. Copy the DATABASE_URL (should contain "railway" in the host)');
      console.error('   3. Go to Railway → Backend service → Variables');
      console.error('   4. Update DATABASE_URL with the Railway connection string');
    } else {
      console.error('   1. DATABASE_URL host might not be accessible');
      console.error('   2. Check your DATABASE_URL in Railway environment variables');
      console.error('   3. Verify the PostgreSQL service is running');
    }
  }
  // Don't exit in production - just log the error
  if (process.env.NODE_ENV !== 'production') {
    process.exit(-1);
  }
  });
}

// Export the pool for use in routes (null if DATABASE_URL not set)
export default pool;

// Helper function to test the database connection
export async function testConnection() {
  if (!process.env.DATABASE_URL || !pool) {
    throw new Error('PostgreSQL not configured. DATABASE_URL is required.');
  }
  try {
    const result = await pool.query('SELECT NOW(), version()');
    return {
      now: result.rows[0].now,
      version: result.rows[0].version,
      connected: true
    };
  } catch (error) {
    console.error('Database connection error:', error);
    console.error('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Missing!');
    throw error;
  }
}

