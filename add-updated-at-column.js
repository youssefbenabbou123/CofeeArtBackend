import pool from './db.js';
import dotenv from 'dotenv';

dotenv.config();

async function addUpdatedAtColumn() {
  try {
    console.log('🔄 Adding updated_at column to orders table...');
    
    // Check if column exists
    const checkResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'updated_at'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ updated_at column already exists');
      process.exit(0);
    }
    
    // Add the column
    await pool.query(`
      ALTER TABLE orders 
      ADD COLUMN updated_at TIMESTAMP DEFAULT now()
    `);
    
    // Create index
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON orders(updated_at DESC)
    `);
    
    console.log('✅ Successfully added updated_at column to orders table');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding updated_at column:', error);
    process.exit(1);
  }
}

addUpdatedAtColumn();

