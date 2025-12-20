import pool from '../db.js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createProductCategoriesTable() {
  try {
    console.log('Creating product_categories table...');
    
    const sql = readFileSync(join(__dirname, '../migrations/012_create_product_categories.sql'), 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ Product categories table created successfully!');
    console.log('✅ 4 default categories inserted:');
    console.log('   - Céramiques');
    console.log('   - Goodies / Lifestyle');
    console.log('   - Cartes cadeaux');
    console.log('   - Accessoires');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating product categories table:', error);
    process.exit(1);
  }
}

createProductCategoriesTable();


