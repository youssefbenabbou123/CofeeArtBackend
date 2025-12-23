import pool from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

const productTitle = 'Affiche Café de Spécialité';

async function deleteProduct() {
  const client = await pool.connect();
  
  try {
    console.log(`🔄 Recherche du produit: "${productTitle}"...`);
    
    // First, let's check if it exists with different case variations
    const checkResult = await client.query(
      `SELECT id, title FROM products WHERE LOWER(title) LIKE LOWER($1)`,
      [`%${productTitle.toLowerCase()}%`]
    );
    
    if (checkResult.rows.length === 0) {
      console.log(`⚠️  Aucun produit trouvé avec le titre "${productTitle}"`);
      
      // Try to find similar titles
      const similarResult = await client.query(
        `SELECT id, title FROM products WHERE title ILIKE $1`,
        ['%Affiche Café%']
      );
      
      if (similarResult.rows.length > 0) {
        console.log('\n📋 Produits similaires trouvés:');
        similarResult.rows.forEach(row => {
          console.log(`   - ${row.title} (ID: ${row.id})`);
        });
      }
    } else {
      for (const product of checkResult.rows) {
        const deleteResult = await client.query(
          'DELETE FROM products WHERE id = $1 RETURNING id, title',
          [product.id]
        );
        
        if (deleteResult.rows.length > 0) {
          console.log(`✅ Supprimé: ${deleteResult.rows[0].title} (ID: ${deleteResult.rows[0].id})`);
        }
      }
    }
    
    console.log(`\n✅ Opération terminée !`);
    
  } catch (error) {
    console.error('❌ Erreur lors de la suppression:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

deleteProduct();

