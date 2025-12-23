import pool from '../db.js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Running migration 016_add_multiple_images.sql...');
    
    await client.query('BEGIN');
    
    // Read migration file
    const migrationPath = join(__dirname, '..', 'migrations', '016_add_multiple_images.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    // Execute migration
    await client.query(migrationSQL);
    
    await client.query('COMMIT');
    
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error running migration:', error);
    console.error(error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();


