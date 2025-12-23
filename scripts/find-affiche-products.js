import pool from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

async function findAfficheProducts() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Recherche de tous les produits contenant "Affiche" ou "Café"...\n');
    
    // Search for products with "Affiche" or "Café" in title
    const result = await client.query(
      `SELECT id, title, price, category FROM products 
       WHERE title ILIKE '%Affiche%' OR title ILIKE '%Café%' OR title ILIKE '%Cafe%'
       ORDER BY title`
    );
    
    if (result.rows.length === 0) {
      console.log('✅ Aucun produit trouvé avec "Affiche" ou "Café" dans le titre.');
    } else {
      console.log(`📋 ${result.rows.length} produit(s) trouvé(s):\n`);
      result.rows.forEach((product, index) => {
        console.log(`${index + 1}. ${product.title}`);
        console.log(`   ID: ${product.id}`);
        console.log(`   Prix: ${product.price}€`);
        console.log(`   Catégorie: ${product.category || 'Non définie'}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

findAfficheProducts();

