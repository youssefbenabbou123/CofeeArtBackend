import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Note: This file is ONLY for migration scripts that need PostgreSQL
// The main application uses MongoDB (db-mongodb.js)
// If DATABASE_URL is not set, this file does nothing and exports a dummy pool

let pool = null;

if (process.env.DATABASE_URL) {
  // Only initialize PostgreSQL if DATABASE_URL is set (for migration scripts)
  const poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  };

  pool = new Pool(poolConfig);

  pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL (for migration scripts)');
  });

  pool.on('error', (err) => {
    console.error('❌ PostgreSQL connection error:', err.message);
  });
} else {
  // Create a dummy pool that throws errors if used
  pool = {
    query: () => {
      throw new Error('PostgreSQL not configured. DATABASE_URL is required for PostgreSQL operations.');
    },
    connect: () => {
      throw new Error('PostgreSQL not configured. DATABASE_URL is required for PostgreSQL operations.');
    },
    end: () => Promise.resolve()
  };
}

// Export the pool
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
    throw error;
  }
}
