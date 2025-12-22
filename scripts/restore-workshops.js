import dotenv from 'dotenv';
import pool from '../db.js';

dotenv.config();

const defaultWorkshops = [
  {
    title: "Initiation au tournage de poterie",
    description: "Découvrez les bases du tournage sur potier lors de cet atelier d'initiation. Vous apprendrez à centrer l'argile, créer des formes de base et réaliser votre première pièce en céramique.",
    level: "débutant",
    duration: 120, // 2 hours
    price: 75.00,
    image: "/ceramic-pottery-workshop-hands-creating-clay-potte.jpg",
    status: "active",
    capacity: 4
  },
  {
    title: "Tournage perfectionnement",
    description: "Pour les personnes ayant déjà une base en tournage. Approfondissez vos techniques, apprenez à créer des formes plus complexes et à maîtriser les finitions.",
    level: "intermédiaire",
    duration: 180, // 3 hours
    price: 95.00,
    image: "/artisan-coffee-cafe-with-ceramic-pottery-handmade-.jpg",
    status: "active",
    capacity: 4
  },
  {
    title: "Modelage libre - Création d'une pièce unique",
    description: "Laissez libre cours à votre créativité avec le modelage. Créez une pièce unique à la main en utilisant différentes techniques : colombin, plaque, estampage. Atelier sans tour, parfait pour débuter.",
    level: "débutant",
    duration: 150, // 2.5 hours
    price: 65.00,
    image: "/boutique/tasse-artisanale.jpg",
    status: "active",
    capacity: 6
  }
];

async function restoreWorkshops() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🔄 Restoring workshops...');
    
    const insertedWorkshops = [];
    
    for (const workshop of defaultWorkshops) {
      const result = await client.query(
        `INSERT INTO workshops (title, description, level, duration, price, image, status, capacity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, title`,
        [
          workshop.title,
          workshop.description,
          workshop.level,
          workshop.duration,
          workshop.price,
          workshop.image,
          workshop.status,
          workshop.capacity
        ]
      );
      
      insertedWorkshops.push(result.rows[0]);
      console.log(`   ✅ Created: ${workshop.title}`);
    }
    
    await client.query('COMMIT');
    console.log(`\n✅ Successfully restored ${insertedWorkshops.length} workshops!`);
    console.log('\n📋 Workshops created:');
    insertedWorkshops.forEach((w, i) => {
      console.log(`   ${i + 1}. ${w.title} (ID: ${w.id})`);
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error restoring workshops:', error);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

restoreWorkshops();

