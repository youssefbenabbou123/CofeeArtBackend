import pool from '../db.js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function addTestGoodies() {
  try {
    console.log('Adding test goodies products...');
    console.log('Testing database connection...');
    
    // Test connection first
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful');
    
    // Insert products directly using individual queries
    const products = [
      {
        title: 'Tote Bag Coffee Arts',
        description: 'Tote bag en coton bio avec notre logo Coffee Arts. Parfait pour vos courses ou vos sorties. Dimensions: 40x42 cm. Lavable en machine.',
        price: 25.00,
        image: '/boutique/tote-bag-coffee-arts.jpg',
        category: 'Tote bags',
        status: 'active'
      },
      {
        title: 'Tote Bag Céramique',
        description: 'Tote bag élégant avec motif céramique. Matériau durable et écologique. Dimensions: 38x40 cm. Idéal pour transporter vos créations ou vos affaires.',
        price: 28.00,
        image: '/boutique/tote-bag-ceramique.jpg',
        category: 'Tote bags',
        status: 'active'
      },
      {
        title: 'Tote Bag Minimaliste',
        description: 'Tote bag sobre et minimaliste, parfait pour un usage quotidien. Coton épais et résistant. Dimensions: 35x38 cm.',
        price: 22.00,
        image: '/boutique/tote-bag-minimaliste.jpg',
        category: 'Tote bags',
        status: 'active'
      },
      {
        title: 'Affiche Coffee Arts',
        description: 'Affiche design représentant notre univers café et céramique. Impression haute qualité sur papier premium. Format A3 (29.7 x 42 cm). Parfait pour décorer votre intérieur.',
        price: 35.00,
        image: '/boutique/affiche-coffee-arts.jpg',
        category: 'Affiches / prints',
        status: 'active'
      },
      {
        title: 'Print Céramique Moderne',
        description: 'Print artistique mettant en valeur l\'art de la céramique. Design contemporain et élégant. Format A4 (21 x 29.7 cm). Encadrement non inclus.',
        price: 18.00,
        image: '/boutique/print-ceramique-moderne.jpg',
        category: 'Affiches / prints',
        status: 'active'
      },
      {
        title: 'Affiche Café de Spécialité',
        description: 'Affiche illustrée dédiée aux amateurs de café. Design vintage et chaleureux. Format A3 (29.7 x 42 cm). Impression sur papier mat premium.',
        price: 32.00,
        image: '/boutique/affiche-cafe-specialite.jpg',
        category: 'Affiches / prints',
        status: 'active'
      },
      {
        title: 'Print Minimaliste',
        description: 'Print minimaliste avec typographie élégante. Parfait pour un intérieur moderne. Format A4 (21 x 29.7 cm). Disponible en plusieurs couleurs.',
        price: 20.00,
        image: '/boutique/print-minimaliste.jpg',
        category: 'Affiches / prints',
        status: 'active'
      }
    ];

    let addedCount = 0;
    let skippedCount = 0;

    for (const product of products) {
      // Check if product already exists
      const checkResult = await pool.query(
        'SELECT id FROM products WHERE title = $1',
        [product.title]
      );

      if (checkResult.rows.length > 0) {
        console.log(`⏭️  Skipped: ${product.title} (already exists)`);
        skippedCount++;
        continue;
      }

      // Insert product
      await pool.query(
        `INSERT INTO products (title, description, price, image, category, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          product.title,
          product.description,
          product.price,
          product.image,
          product.category,
          product.status
        ]
      );

      console.log(`✅ Added: ${product.title} (${product.price}€)`);
      addedCount++;
    }

    console.log('');
    console.log('✅ Test goodies products processed!');
    console.log(`   Added: ${addedCount} products`);
    console.log(`   Skipped: ${skippedCount} products (already exist)`);
    console.log('');
    console.log('📦 Products added:');
    console.log('   Tote bags:');
    console.log('     - Tote Bag Coffee Arts (25€)');
    console.log('     - Tote Bag Céramique (28€)');
    console.log('     - Tote Bag Minimaliste (22€)');
    console.log('   Affiches / prints:');
    console.log('     - Affiche Coffee Arts (35€)');
    console.log('     - Print Céramique Moderne (18€)');
    console.log('     - Affiche Café de Spécialité (32€)');
    console.log('     - Print Minimaliste (20€)');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding test goodies:', error);
    if (error.code === 'EAI_AGAIN' || error.code === 'ECONNREFUSED') {
      console.error('');
      console.error('⚠️  Database connection error!');
      console.error('   This could be due to:');
      console.error('   1. Network connectivity issues');
      console.error('   2. DATABASE_URL not set correctly');
      console.error('   3. Railway database not accessible');
      console.error('');
      console.error('   Alternative: You can add these products manually through the admin panel at /admin/goodies');
    }
    await pool.end().catch(() => {});
    process.exit(1);
  }
}

addTestGoodies();

