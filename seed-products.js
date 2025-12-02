import pool from './db.js';
import dotenv from 'dotenv';

dotenv.config();

const products = [
  {
    title: "Tasse Artisanale",
    description: "Une tasse artisanale unique, façonnée à la main par nos céramistes. Chaque pièce est unique et témoigne du savoir-faire traditionnel. Parfaite pour votre café du matin ou votre thé de l'après-midi.",
    price: 24.00,
    image: "/boutique/tasse-artisanale.jpg"
  },
  {
    title: "Assiette Céramique",
    description: "Une assiette céramique élégante et fonctionnelle, parfaite pour sublimer vos plats. Le design minimaliste met en valeur la qualité de la céramique artisanale.",
    price: 32.00,
    image: "/boutique/Assiette-Artisanale.jpg"
  },
  {
    title: "Bol Fait Main",
    description: "Un bol artisanal chaleureux et généreux, idéal pour vos soupes, salades ou céréales. Sa forme ergonomique et sa finition soignée en font un objet du quotidien raffiné.",
    price: 28.00,
    image: "/boutique/bol-fait.jpg"
  },
  {
    title: "Vase Minimaliste",
    description: "Un vase minimaliste aux lignes épurées qui met en valeur vos bouquets. Design contemporain alliant esthétique et fonctionnalité, parfait pour créer une ambiance zen.",
    price: 45.00,
    image: "/boutique/vase-minimaliste.jpg"
  },
  {
    title: "Théière Artisanale",
    description: "Une théière artisanale élégante, parfaite pour vos cérémonies de thé. Sa forme traditionnelle et son design raffiné en font un objet de collection.",
    price: 55.00,
    image: "/boutique/Théière-Artisanale.jpg"
  },
  {
    title: "Set de Baguettes",
    description: "Un set de baguettes en céramique artisanale, alliant tradition et modernité. Parfait pour accompagner vos plats asiatiques ou pour une décoration élégante.",
    price: 18.00,
    image: "/boutique/Set de Baguettes.webp"
  },
  {
    title: "Pot Décoratif",
    description: "Un pot décoratif aux motifs subtils, parfait pour apporter une touche d'élégance à votre intérieur. Peut également servir de rangement pour vos objets précieux.",
    price: 38.00,
    image: "/boutique/Pot Décoratif.png"
  },
  {
    title: "Plateaux Géométriques",
    description: "Des plateaux géométriques modernes aux formes épurées. Parfaits pour servir vos apéritifs, petits-déjeuners ou comme éléments décoratifs.",
    price: 42.00,
    image: "/boutique/Plateaux Géométriques.jpg"
  }
];

async function seedProducts() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Seeding products into database...');
    
    // Clear existing products (optional - comment out if you want to keep existing)
    // await client.query('DELETE FROM products');
    
    for (const product of products) {
      const result = await client.query(
        'INSERT INTO products (title, description, price, image) VALUES ($1, $2, $3, $4) RETURNING id, title',
        [product.title, product.description, product.price, product.image]
      );
      console.log(`✅ Inserted: ${result.rows[0].title} (ID: ${result.rows[0].id})`);
    }
    
    console.log(`\n✅ Successfully seeded ${products.length} products!`);
    
  } catch (error) {
    console.error('❌ Error seeding products:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedProducts();

