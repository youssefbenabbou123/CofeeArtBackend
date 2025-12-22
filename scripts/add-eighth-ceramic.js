import pool from '../db.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function addEighthCeramicProduct() {
  let client;
  
  try {
    console.log('🔄 Connecting to database...');
    client = await pool.connect();
    
    console.log('📦 Adding eighth ceramic product (Plateau Céramique Artisanal)...');
    
    // Read and execute the migration SQL file
    const sqlFile = join(__dirname, '..', 'migrations', '015_add_eighth_ceramic_product.sql');
    const sql = readFileSync(sqlFile, 'utf8');
    
    await client.query(sql);
    
    console.log('✅ Eighth ceramic product added successfully!');
    
    // Verify the product was added
    const result = await client.query(
      "SELECT id, title, category, price FROM products WHERE title = 'Plateau Céramique Artisanal'"
    );
    
    if (result.rows.length > 0) {
      const product = result.rows[0];
      console.log('\n📋 Product details:');
      console.log(`   - ID: ${product.id}`);
      console.log(`   - Title: ${product.title}`);
      console.log(`   - Category: ${product.category}`);
      console.log(`   - Price: ${product.price}€`);
    }
    
  } catch (error) {
    console.error('❌ Error adding product:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

addEighthCeramicProduct();

