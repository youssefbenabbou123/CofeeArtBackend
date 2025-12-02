import pool from './db.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting database migration...');
    
    // Run first migration
    console.log('📦 Running migration 001: Create base tables...');
    const sqlFile1 = join(__dirname, 'migrations', '001_create_tables.sql');
    const sql1 = readFileSync(sqlFile1, 'utf8');
    await client.query(sql1);
    console.log('✅ Migration 001 completed!');
    
    // Run second migration
    console.log('📦 Running migration 002: Add admin features...');
    const sqlFile2 = join(__dirname, 'migrations', '002_add_admin_features.sql');
    const sql2 = readFileSync(sqlFile2, 'utf8');
    await client.query(sql2);
    console.log('✅ Migration 002 completed!');
    
    console.log('✅ All migrations completed successfully!');
    console.log('📊 Tables created/updated:');
    console.log('   - users');
    console.log('   - products (with category and status columns)');
    console.log('   - product_variants');
    console.log('   - orders');
    console.log('   - order_items');
    console.log('   - workshops');
    console.log('   - reservations');
    console.log('   - blog_posts');
    console.log('   - contact_messages');
    console.log('   - site_settings');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();

