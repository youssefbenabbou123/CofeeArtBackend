import pool from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

const productsToDelete = [
  'Print Minimaliste',
  'Affiche Café de spécialité',
  'Affiche Café de Spécialité', // Variante avec majuscule
  'Print Céramique Moderne',
  'Affiche Coffee Arts',
  'Tote Bag Minimaliste',
  'Tote Bag Céramique',
  'Tote Bag Coffee Arts'
];

async function deleteGoodiesProducts() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Suppression des produits goodies...');
    
    for (const title of productsToDelete) {
      const result = await client.query(
        'DELETE FROM products WHERE title = $1 RETURNING id, title',
        [title]
      );
      
      if (result.rows.length > 0) {
        console.log(`✅ Supprimé: ${result.rows[0].title} (ID: ${result.rows[0].id})`);
      } else {
        console.log(`⚠️  Non trouvé: ${title}`);
      }
    }
    
    console.log(`\n✅ Suppression terminée !`);
    
  } catch (error) {
    console.error('❌ Erreur lors de la suppression:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

deleteGoodiesProducts();

