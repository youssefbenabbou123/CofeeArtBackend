import pool from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

async function addSampleWorkshops() {
  try {
    console.log('🔄 Adding sample workshops to database...');

    // Workshop 1: Atelier Tournage Initiation
    const workshop1Result = await pool.query(`
      INSERT INTO workshops (title, description, level, duration, price, image, status, capacity)
      VALUES (
        'Atelier Tournage Initiation',
        'Découvrez l''art du tournage de poterie dans cet atelier d''initiation. Apprenez les techniques de base pour centrer l''argile, créer des formes symétriques et réaliser vos premières pièces. Matériel et argile fournis, cuisson incluse. Parfait pour les débutants qui souhaitent découvrir la céramique.',
        'débutant',
        150,
        50.00,
        '/ceramic-pottery-workshop-hands-creating-clay-potte.jpg',
        'active',
        4
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `);

    if (workshop1Result.rows.length > 0) {
      const workshop1Id = workshop1Result.rows[0].id;
      console.log('✅ Created: Atelier Tournage Initiation');

      // Add sessions for Workshop 1
      await pool.query(`
        INSERT INTO workshop_sessions (workshop_id, session_date, session_time, capacity, booked_count, status)
        VALUES
          ($1, CURRENT_DATE + INTERVAL '7 days', '10:00:00', 4, 0, 'active'),
          ($1, CURRENT_DATE + INTERVAL '14 days', '14:00:00', 4, 0, 'active'),
          ($1, CURRENT_DATE + INTERVAL '21 days', '18:00:00', 4, 0, 'active')
      `, [workshop1Id]);
      console.log('   Added 3 sessions');
    }

    // Workshop 2: Atelier Modelage Créatif
    const workshop2Result = await pool.query(`
      INSERT INTO workshops (title, description, level, duration, price, image, status, capacity)
      VALUES (
        'Atelier Modelage Créatif',
        'Libérez votre créativité avec le modelage à la main. Explorez différentes techniques : colombin, plaque, estampage. Créez des pièces uniques et personnalisées selon vos envies. Cet atelier convient aux débutants comme aux personnes ayant déjà une expérience. Accompagnement personnalisé par nos céramistes.',
        'intermédiaire',
        180,
        75.00,
        '/artisan-coffee-cafe-with-ceramic-pottery-handmade-.jpg',
        'active',
        4
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `);

    if (workshop2Result.rows.length > 0) {
      const workshop2Id = workshop2Result.rows[0].id;
      console.log('✅ Created: Atelier Modelage Créatif');

      // Add sessions for Workshop 2
      await pool.query(`
        INSERT INTO workshop_sessions (workshop_id, session_date, session_time, capacity, booked_count, status)
        VALUES
          ($1, CURRENT_DATE + INTERVAL '8 days', '10:00:00', 4, 0, 'active'),
          ($1, CURRENT_DATE + INTERVAL '15 days', '14:00:00', 4, 0, 'active'),
          ($1, CURRENT_DATE + INTERVAL '22 days', '18:00:00', 4, 0, 'active')
      `, [workshop2Id]);
      console.log('   Added 3 sessions');
    }

    // Workshop 3: Atelier Émaillage & Finitions
    const workshop3Result = await pool.query(`
      INSERT INTO workshops (title, description, level, duration, price, image, status, capacity)
      VALUES (
        'Atelier Émaillage & Finitions',
        'Apprenez l''art de l''émaillage pour donner vie et couleur à vos créations céramiques. Découvrez notre palette variée d''émaux, les techniques d''application et les effets possibles. Cet atelier est idéal pour ceux qui souhaitent finaliser leurs pièces avec des finitions professionnelles. Vous pouvez apporter vos propres pièces biscuitées ou utiliser celles de l''atelier.',
        'avancé',
        120,
        65.00,
        '/boutique/tasse-artisanale.jpg',
        'active',
        6
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `);

    if (workshop3Result.rows.length > 0) {
      const workshop3Id = workshop3Result.rows[0].id;
      console.log('✅ Created: Atelier Émaillage & Finitions');

      // Add sessions for Workshop 3
      await pool.query(`
        INSERT INTO workshop_sessions (workshop_id, session_date, session_time, capacity, booked_count, status)
        VALUES
          ($1, CURRENT_DATE + INTERVAL '9 days', '10:00:00', 6, 0, 'active'),
          ($1, CURRENT_DATE + INTERVAL '16 days', '14:00:00', 6, 0, 'active'),
          ($1, CURRENT_DATE + INTERVAL '23 days', '18:00:00', 6, 0, 'active')
      `, [workshop3Id]);
      console.log('   Added 3 sessions');
    }

    console.log('\n✅ Sample workshops added successfully!');
    console.log('   - Atelier Tournage Initiation (50€, 2h30, débutant)');
    console.log('   - Atelier Modelage Créatif (75€, 3h00, intermédiaire)');
    console.log('   - Atelier Émaillage & Finitions (65€, 2h00, avancé)');
  } catch (error) {
    console.error('❌ Error adding sample workshops:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

addSampleWorkshops();

