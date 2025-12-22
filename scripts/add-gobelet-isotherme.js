import pool from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

async function addGobeletIsotherme() {
  const client = await pool.connect();
  let clientReleased = false;
  
  try {
    console.log('🔄 Adding Gobelet Isotherme X Coffee Arts Paris...');
    
    await client.query('BEGIN');
    
    // Check if images column exists, if not create it
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'images'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('📝 Creating images column...');
      await client.query(`
        ALTER TABLE products 
        ADD COLUMN images JSONB DEFAULT '[]'::jsonb
      `);
      console.log('✅ Images column created');
    }
    
    // Check if product already exists
    const checkResult = await client.query(
      "SELECT id FROM products WHERE title = 'Gobelet Isotherme X Coffee Arts Paris'"
    );
    
    if (checkResult.rows.length > 0) {
      console.log('⚠️  Product already exists, skipping...');
      await client.query('ROLLBACK');
      client.release();
      clientReleased = true;
      await pool.end();
      process.exit(0);
    }
    
    // Check if features column exists
    const featuresColumnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'features'
    `);
    
    if (featuresColumnCheck.rows.length === 0) {
      console.log('📝 Creating features column...');
      await client.query(`
        ALTER TABLE products 
        ADD COLUMN features JSONB DEFAULT '[]'::jsonb
      `);
      console.log('✅ Features column created');
    }
    
    // Product data
    const productData = {
      title: 'Gobelet Isotherme X Coffee Arts Paris',
      description: 'Gobelet à emporter en acier inoxydable, idéal pour conserver vos boissons chaudes ou froides lors de vos moments créatifs chez Coffee Arts Paris.',
      price: 25.00,
      stock: 49,
      images: JSON.stringify([
        '/PRODUIT 1 - PARTIE 1.jpg',
        '/PRODUIT 1 - PARTIE 2.jpg'
      ]),
      image: '/PRODUIT 1 - PARTIE 1.jpg', // First image for backward compatibility
      features: JSON.stringify([
        'Contenance : 350 ml (12 oz)',
        'Matière : Acier inoxydable',
        'Couleur : Vert kaki',
        'Finition : Mate',
        'Type : Gobelet à emporter avec anse',
        'Couvercle : Oui (anti-éclaboussures)',
        'Isolation : Thermique (conserve la chaleur et le froid)',
        'Utilisation : Boissons chaudes et froides',
        'Réutilisable : Oui',
        'Sans BPA : Oui',
        'Entretien : Lavage à la main recommandé'
      ]),
      category: 'Accessoires',
      status: 'active'
    };
    
    // Insert product
    const result = await client.query(
      `INSERT INTO products (title, description, price, stock, images, image, features, category, status)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8, $9)
       RETURNING id, title, price, stock`,
      [
        productData.title,
        productData.description,
        productData.price,
        productData.stock,
        productData.images,
        productData.image,
        productData.features,
        productData.category,
        productData.status
      ]
    );
    
    const product = result.rows[0];
    
    await client.query('COMMIT');
    
    console.log('✅ Product added successfully!');
    console.log(`   ID: ${product.id}`);
    console.log(`   Title: ${product.title}`);
    console.log(`   Price: ${product.price}€`);
    console.log(`   Stock: ${product.stock}`);
    console.log(`   Images: ${productData.images}`);
    console.log(`   Features: ${productData.features}`);
    
    process.exit(0);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // Ignore rollback errors
    }
    console.error('❌ Error adding product:', error);
    console.error(error.message);
    process.exit(1);
  } finally {
    if (!clientReleased) {
      try {
        client.release();
      } catch (releaseError) {
        // Client might already be released
      }
    }
    try {
      await pool.end();
    } catch (endError) {
      // Pool might already be ended
    }
  }
}

addGobeletIsotherme();

