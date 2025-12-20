import pool from '../db.js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  try {
    console.log('Running gift cards enhancement migration...');
    
    const sql = readFileSync(join(__dirname, '../migrations/013_enhance_gift_cards.sql'), 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ Gift cards migration completed successfully!');
    console.log('✅ Added columns: category, used, purchaser_id, purchaser_email, purchaser_name');
    console.log('✅ Added expiry date trigger and expiration check function');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error running migration:', error);
    process.exit(1);
  }
}

runMigration();


