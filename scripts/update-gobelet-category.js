import pool from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

const productTitle = 'Gobelet Isotherme X Coffee Arts Paris';
const newCategory = 'Goodies / Lifestyle';

async function updateGobeletCategory() {
  const client = await pool.connect();
  
  try {
    console.log(`🔄 Mise à jour de la catégorie du produit: "${productTitle}"...\n`);
    
    // First, find the product
    const findResult = await client.query(
      `SELECT id, title, category FROM products WHERE title ILIKE $1`,
      [`%${productTitle}%`]
    );
    
    if (findResult.rows.length === 0) {
      console.log(`⚠️  Produit non trouvé: "${productTitle}"`);
      
      // Try to find similar products
      const similarResult = await client.query(
        `SELECT id, title, category FROM products WHERE title ILIKE $1`,
        ['%Gobelet%']
      );
      
      if (similarResult.rows.length > 0) {
        console.log('\n📋 Produits similaires trouvés:');
        similarResult.rows.forEach(row => {
          console.log(`   - ${row.title} (Catégorie: ${row.category || 'Non définie'})`);
        });
      }
      return;
    }
    
    // Update the category
    for (const product of findResult.rows) {
      const updateResult = await client.query(
        `UPDATE products 
         SET category = $1 
         WHERE id = $2 
         RETURNING id, title, category`,
        [newCategory, product.id]
      );
      
      if (updateResult.rows.length > 0) {
        const updated = updateResult.rows[0];
        console.log(`✅ Catégorie mise à jour:`);
        console.log(`   Produit: ${updated.title}`);
        console.log(`   Ancienne catégorie: ${product.category || 'Non définie'}`);
        console.log(`   Nouvelle catégorie: ${updated.category}`);
      }
    }
    
    console.log(`\n✅ Mise à jour terminée !`);
    
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

updateGobeletCategory();

