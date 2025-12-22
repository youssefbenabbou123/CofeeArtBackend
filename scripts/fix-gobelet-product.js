import pool from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

async function fixGobeletProduct() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking Gobelet Isotherme product...');
    
    // Find the product
    const result = await client.query(
      "SELECT id, title, category, status, archived FROM products WHERE title LIKE '%Gobelet%' OR title LIKE '%Isotherme%'"
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Product not found');
      process.exit(1);
    }
    
    console.log(`\n📋 Found ${result.rows.length} product(s):`);
    result.rows.forEach((product, index) => {
      console.log(`\n${index + 1}. ${product.title}`);
      console.log(`   ID: ${product.id}`);
      console.log(`   Category: ${product.category || 'NULL'}`);
      console.log(`   Status: ${product.status || 'NULL'}`);
      console.log(`   Archived: ${product.archived || false}`);
    });
    
    // Update all gobelet products to be active and in Accessoires category
    const updateResult = await client.query(
      `UPDATE products 
       SET status = 'active', 
           archived = false, 
           category = 'Accessoires'
       WHERE title LIKE '%Gobelet%' OR title LIKE '%Isotherme%'
       RETURNING id, title, category, status, archived`
    );
    
    console.log(`\n✅ Updated ${updateResult.rowCount} product(s):`);
    updateResult.rows.forEach((product) => {
      console.log(`   - ${product.title}`);
      console.log(`     Category: ${product.category}`);
      console.log(`     Status: ${product.status}`);
      console.log(`     Archived: ${product.archived}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

fixGobeletProduct();

