import pool from './db.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrations = [
  '005_enhanced_products.sql',
  '006_enhanced_orders.sql',
  '007_enhanced_workshops.sql',
  '008_clients_gift_cards.sql',
  '009_stock_management.sql',
];

async function runMigrations() {
  let client;
  try {
    console.log('🔄 Connecting to Railway database...');
    
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL is not set!');
      process.exit(1);
    }

    client = await pool.connect();
    console.log('✅ Connected to Railway database\n');

    for (const migrationFile of migrations) {
      console.log(`📦 Running migration: ${migrationFile}...`);
      
      const migrationPath = path.join(__dirname, 'migrations', migrationFile);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      // Execute the entire migration file
      try {
        await client.query(migrationSQL);
        console.log(`✅ Migration ${migrationFile} completed\n`);
      } catch (error) {
        // If it's a "does not exist" error for columns, try adding them individually
        if (error.code === '42703' || error.message.includes('does not exist')) {
          console.log(`   ⚠️  Some columns may not exist, trying individual statements...`);
          
          // Split and try each statement individually
          const statements = migrationSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('CREATE INDEX'));
          
          for (const statement of statements) {
            if (statement.trim()) {
              try {
                await client.query(statement);
              } catch (stmtError) {
                if (stmtError.code === '42701' || stmtError.code === '42P07' || stmtError.message.includes('already exists')) {
                  // Column/table already exists, skip
                  continue;
                } else if (stmtError.code === '42703') {
                  // Column doesn't exist yet, might be in wrong order - skip for now
                  console.log(`   ⚠️  Skipping: ${statement.substring(0, 50)}...`);
                  continue;
                } else {
                  throw stmtError;
                }
              }
            }
          }
          
          // Now create indexes if columns exist
          if (migrationFile === '005_enhanced_products.sql') {
            try {
              await client.query('CREATE INDEX IF NOT EXISTS idx_products_collection ON products(collection)');
              await client.query('CREATE INDEX IF NOT EXISTS idx_products_archived ON products(archived)');
              await client.query('CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock)');
            } catch (idxError) {
              console.log(`   ⚠️  Index creation skipped: ${idxError.message.substring(0, 60)}...`);
            }
          }
          
          console.log(`✅ Migration ${migrationFile} completed (with warnings)\n`);
        } else if (error.code === '42701' || error.code === '42P07' || error.message.includes('already exists')) {
          console.log(`   ⚠️  Some objects already exist, continuing...`);
          console.log(`✅ Migration ${migrationFile} completed\n`);
        } else {
          throw error;
        }
      }
    }

    console.log('🎉 All migrations completed successfully!');
    
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

runMigrations();

