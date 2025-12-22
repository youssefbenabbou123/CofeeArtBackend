import pool from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

// Ceramic product categories
const ceramicCategories = [
  'Tasses',
  'Assiettes',
  'Bols',
  'Vases',
  'Théières',
  'Plateaux',
  'Accessoires',
  'Décoration'
];

// Keywords that indicate ceramic products
const ceramicKeywords = [
  'céramique',
  'ceramic',
  'tasse',
  'assiette',
  'bol',
  'vase',
  'théière',
  'theiere',
  'pot',
  'plateau',
  'baguette',
  'artisanale',
  'artisanal',
  'fait main',
  'faite main'
];

// Categories and keywords that indicate GOODIES (to EXCLUDE from deletion)
const goodiesCategories = [
  'Goodies / Lifestyle',
  'Tote bags',
  'Affiches / prints'
];

const goodiesKeywords = [
  'tote',
  'sac',
  'affiche',
  'print',
  'poster'
];

async function removeCeramicProducts() {
  try {
    console.log('🔄 Removing ceramic products from database...');
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // First, find all ceramic products
      // Build keyword conditions for ceramic products
      const ceramicKeywordConditions = ceramicKeywords.map(kw => 
        `(LOWER(title) LIKE '%${kw}%' OR LOWER(description) LIKE '%${kw}%')`
      ).join(' OR ');
      
      // Build exclusion conditions for goodies (to exclude from deletion)
      const goodiesExclusionConditions = goodiesKeywords.length > 0 
        ? goodiesKeywords.map(kw => `LOWER(title) LIKE '%${kw}%'`).join(' OR ')
        : 'FALSE'; // If no goodies keywords, use FALSE so it doesn't exclude anything
      
      const findQuery = `
        SELECT id, title, category, description
        FROM products
        WHERE (
          (category = ANY($1::text[]) OR ${ceramicKeywordConditions})
          AND (category IS NULL OR category != ALL($2::text[]))
          AND NOT (${goodiesExclusionConditions})
        )
        AND (archived = false OR archived IS NULL)
      `;
      
      const categoryArray = ceramicCategories;
      const goodiesCategoryArray = goodiesCategories;
      
      const findResult = await client.query(findQuery, [categoryArray, goodiesCategoryArray]);
      
      console.log(`\n📋 Found ${findResult.rows.length} ceramic product(s) to delete:`);
      findResult.rows.forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.title} (${product.category || 'No category'})`);
      });
      
      if (findResult.rows.length === 0) {
        console.log('✅ No ceramic products found to delete.');
        await client.query('ROLLBACK');
        client.release();
        await pool.end();
        process.exit(0);
      }
      
      const productIds = findResult.rows.map(p => p.id);
      
      // Delete order_items first (due to foreign key constraint)
      const orderItemsResult = await client.query(
        'DELETE FROM order_items WHERE product_id = ANY($1::uuid[]) RETURNING id',
        [productIds]
      );
      console.log(`\n✅ Deleted ${orderItemsResult.rowCount} order item(s)`);
      
      // Delete product variants (due to foreign key constraint)
      const variantsResult = await client.query(
        'DELETE FROM product_variants WHERE product_id = ANY($1::uuid[]) RETURNING id',
        [productIds]
      );
      console.log(`✅ Deleted ${variantsResult.rowCount} product variant(s)`);
      
      // Delete the products
      const deleteResult = await client.query(
        'DELETE FROM products WHERE id = ANY($1::uuid[]) RETURNING id, title',
        [productIds]
      );
      
      console.log(`✅ Deleted ${deleteResult.rowCount} ceramic product(s):`);
      deleteResult.rows.forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.title}`);
      });
      
      await client.query('COMMIT');
      
      console.log('\n✅ Successfully removed all ceramic products from database');
      process.exit(0);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
      await pool.end();
    }
  } catch (error) {
    console.error('❌ Error removing ceramic products:', error);
    console.error(error.message);
    process.exit(1);
  }
}

removeCeramicProducts();

