import pool from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSquareMigration() {
  let client;
  try {
    console.log('🔄 Connecting to database...');
    
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL is not set!');
      process.exit(1);
    }

    client = await pool.connect();
    console.log('✅ Connected to database\n');

    console.log('📦 Running migration: 018_add_square_payment_id.sql...');
    
    const migrationPath = path.join(__dirname, 'migrations', '018_add_square_payment_id.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('📊 Added to orders table:');
    console.log('   - square_payment_id column (VARCHAR(255))');
    console.log('   - Index on square_payment_id for faster lookups');
    console.log('\n💡 This migration adds support for Square payment IDs alongside the existing Stripe payment IDs.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.code === '42701' || error.message.includes('already exists')) {
      console.log('⚠️  Column or index already exists - this is okay, migration can be skipped.');
    } else {
      throw error;
    }
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
    process.exit(0);
  }
}

runSquareMigration();




