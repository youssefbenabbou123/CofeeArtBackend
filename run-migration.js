import pool from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  let client;
  try {
    console.log('🔄 Connecting to Railway database...');
    client = await pool.connect();
    
    console.log('📄 Reading migration file...');
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', '003_add_blog_fields.sql'),
      'utf8'
    );
    
    console.log('🚀 Running migration on Railway database...');
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('📊 Blog table is now ready with all required fields.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
    process.exit(0);
  }
}

runMigration();

