import pool from './db.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runAdminMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Running admin features migration...');
    
    // Run second migration (uses IF NOT EXISTS, safe to run multiple times)
    const sqlFile = join(__dirname, 'migrations', '002_add_admin_features.sql');
    const sql = readFileSync(sqlFile, 'utf8');
    await client.query(sql);
    
    console.log('✅ Admin features migration completed successfully!');
    console.log('📊 Added/Updated:');
    console.log('   - contact_messages table');
    console.log('   - site_settings table');
    console.log('   - category column to products');
    console.log('   - status column to products');
    console.log('   - Default site settings');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runAdminMigration();

