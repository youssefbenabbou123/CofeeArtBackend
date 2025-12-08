import pool from './db.js';
import dotenv from 'dotenv';

dotenv.config();

const testBlogs = [
  {
    title: 'Les Secrets de la Céramique Japonaise',
    content: `La céramique japonaise est un art millénaire qui fascine par sa simplicité et son élégance. Dans cet article, nous explorons les techniques ancestrales qui font la beauté unique de cette tradition.

L'Histoire de la Céramique Japonaise
La céramique japonaise remonte à plus de 10 000 ans. Les premières poteries, appelées Jomon, étaient décorées avec des motifs cordés. Au fil des siècles, différentes techniques se sont développées, chacune avec ses caractéristiques propres.

Les Techniques Principales
Parmi les techniques les plus célèbres, on trouve :
- Raku : Une technique de cuisson rapide qui crée des effets uniques
- Kintsugi : L'art de réparer avec de l'or, transformant les fissures en beauté
- Shino : Un glaçage blanc épais qui crée des textures remarquables

L'Esprit Wabi-Sabi
La céramique japonaise incarne l'esthétique wabi-sabi, qui célèbre l'imperfection et la beauté de l'éphémère. Chaque pièce raconte une histoire unique, avec ses imperfections qui la rendent parfaite.

Conclusion
Apprendre la céramique japonaise, c'est s'immerger dans une philosophie de vie qui prône la simplicité, l'authenticité et la beauté dans l'imperfection.`,
    excerpt: 'Découvrez les techniques millénaires qui font la beauté de la céramique japonaise.',
    author: 'Marie Dubois',
    category: 'Techniques',
    slug: 'les-secrets-de-la-ceramique-japonaise',
    published: true
  },
  {
    title: 'Guide Complet: Bien Choisir sa Tasse',
    content: `Choisir la bonne tasse peut transformer votre expérience de dégustation. Voici un guide complet pour trouver la tasse parfaite.

La Forme et la Taille
La forme de votre tasse influence la façon dont vous percevez les arômes. Une tasse large permet aux arômes de se développer, tandis qu'une tasse étroite concentre les saveurs.

Le Matériau
La céramique offre une excellente rétention de chaleur et ne modifie pas le goût. Choisissez une céramique de qualité pour une expérience optimale.

L'Épaisseur
Une tasse épaisse garde le café chaud plus longtemps, tandis qu'une tasse fine offre une sensation plus délicate en bouche.

Le Design
Au-delà de la fonctionnalité, choisissez une tasse qui vous inspire et qui s'harmonise avec votre espace. La beauté de l'objet fait partie de l'expérience.

Conseils Pratiques
- Testez différentes formes pour découvrir vos préférences
- Investissez dans une tasse de qualité qui durera des années
- Choisissez une taille adaptée à votre consommation`,
    excerpt: 'Tous nos conseils pour sélectionner la tasse parfaite selon votre style et vos préférences.',
    author: 'Pierre Martin',
    category: 'Conseils',
    slug: 'guide-complet-bien-choisir-sa-tasse',
    published: true
  },
  {
    title: 'Peinture et Glaçure: L\'Art Décoratif',
    content: `La décoration est l'étape qui transforme une simple pièce de céramique en œuvre d'art. Explorons les différentes techniques.

Les Techniques de Peinture
La peinture sous glaçure permet de créer des motifs durables qui résistent à l'usure. Les pigments sont appliqués avant la cuisson finale.

Les Glaçures
Le glaçage protège la céramique et ajoute une dimension esthétique. Chaque type de glaçure offre un fini unique : mat, brillant, texturé...

Les Couleurs
Le choix des couleurs est crucial. Les tons terre évoquent la nature, tandis que les couleurs vives apportent de la modernité.

Les Motifs
Des motifs géométriques aux illustrations florales, les possibilités sont infinies. Laissez libre cours à votre créativité !`,
    excerpt: 'Explorez les différentes techniques de décoration pour sublimer vos créations céramiques.',
    author: 'Sophie Laurent',
    category: 'Art',
    slug: 'peinture-et-glazure-lart-decoratif',
    published: true
  },
  {
    title: 'Durabilité: La Céramique Écologique',
    content: `La céramique est un choix écologique par excellence. Découvrez pourquoi et comment l'intégrer dans un mode de vie durable.

Un Matériau Naturel
La céramique est fabriquée à partir d'argile, une ressource naturelle abondante. Contrairement au plastique, elle ne libère pas de produits chimiques.

Durabilité Exceptionnelle
Une pièce de céramique bien entretenue peut durer des générations. C'est un investissement à long terme qui réduit les déchets.

Recyclabilité
Même cassée, la céramique peut être recyclée ou réparée avec des techniques comme le kintsugi, prolongeant ainsi sa vie.

Impact Environnemental
En choisissant la céramique artisanale locale, vous réduisez l'empreinte carbone et soutenez l'économie locale.

Conseils pour un Mode de Vie Durable
- Privilégiez les pièces artisanales locales
- Entretenez vos pièces pour les faire durer
- Réparez plutôt que jeter
- Choisissez des pièces intemporelles`,
    excerpt: 'Pourquoi la céramique est le choix idéal pour un mode de vie durable.',
    author: 'Jean Rousseau',
    category: 'Écologie',
    slug: 'durabilite-la-ceramique-ecologique',
    published: true
  },
  {
    title: 'Café & Céramique: L\'Accord Parfait',
    content: `La forme de votre tasse influence directement la dégustation de votre café. Découvrez comment optimiser cette expérience.

La Science de la Dégustation
La forme de la tasse affecte la température, l'aération et la perception des arômes. Chaque type de café mérite sa tasse idéale.

Les Différentes Formes
- Tasse évasée : Parfaite pour les cafés légers, elle permet aux arômes de se développer
- Tasse étroite : Idéale pour les espressos, elle concentre les saveurs intenses
- Tasse large : Parfaite pour les cappuccinos, elle offre de l'espace pour la mousse

La Température
La céramique maintient la température idéale plus longtemps que d'autres matériaux, préservant ainsi tous les arômes.

L'Expérience Sensorielle
Tenir une belle tasse en céramique fait partie intégrante de l'expérience. Le toucher, la vue, tout contribue au plaisir de la dégustation.`,
    excerpt: 'Comment la forme de votre tasse influence la dégustation de votre café préféré.',
    author: 'Thomas Anderson',
    category: 'Lifestyle',
    slug: 'cafe-ceramique-laccord-parfait',
    published: true
  },
  {
    title: 'Les Tendances Céramique 2025',
    content: `Découvrez les tendances qui marqueront l'année 2025 dans le monde de la céramique artisanale.

Minimalisme et Simplicité
Le retour au minimalisme se confirme. Les formes épurées et les lignes simples sont à l'honneur, privilégiant la fonction et l'essentiel.

Textures Brutes
Les textures naturelles et brutes gagnent en popularité. On apprécie les imperfections, les traces de doigts, l'authenticité du matériau.

Couleurs Terre
Les tons terre, sable, terracotta dominent. Ces couleurs chaudes évoquent la nature et apportent une sensation de bien-être.

Formes Organiques
Les formes inspirées de la nature, asymétriques et fluides, remplacent les lignes droites rigides.

Artisanat Local
La valorisation de l'artisanat local et du fait-main continue de croître. Les consommateurs cherchent l'authenticité et l'histoire derrière chaque pièce.

Conclusion
2025 sera l'année de l'authenticité, de la simplicité et du retour aux sources. La céramique artisanale incarne parfaitement ces valeurs.`,
    excerpt: 'Minimalisme, textures brutes et couleurs terre : ce qui nous attend l\'année prochaine.',
    author: 'Sarah Connor',
    category: 'Tendances',
    slug: 'les-tendances-ceramique-2025',
    published: true
  }
];

async function insertBlogs() {
  let client;
  try {
    console.log('🔄 Connecting to Railway database...');
    
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL is not set!');
      process.exit(1);
    }

    client = await pool.connect();
    console.log('✅ Connected to Railway database');
    
    // Check if blogs already exist
    const existingCount = await client.query('SELECT COUNT(*) FROM blog_posts');
    const count = parseInt(existingCount.rows[0].count);
    
    if (count > 0) {
      console.log(`⚠️  Found ${count} existing blogs. Do you want to add more?`);
      console.log('   (This will add new blogs, existing ones will remain)');
    }
    
    console.log(`\n🚀 Inserting ${testBlogs.length} test blogs into Railway database...\n`);
    
    for (let i = 0; i < testBlogs.length; i++) {
      const blog = testBlogs[i];
      
      // Check if slug already exists
      const existing = await client.query(
        'SELECT id FROM blog_posts WHERE slug = $1',
        [blog.slug]
      );
      
      if (existing.rows.length > 0) {
        console.log(`⏭️  Skipping "${blog.title}" (slug already exists)`);
        continue;
      }
      
      await client.query(
        `INSERT INTO blog_posts (title, content, excerpt, author, category, slug, published, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [blog.title, blog.content, blog.excerpt, blog.author, blog.category, blog.slug, blog.published]
      );
      
      console.log(`✅ Inserted: "${blog.title}"`);
    }
    
    // Verify insertion
    const finalCount = await client.query('SELECT COUNT(*) FROM blog_posts');
    console.log(`\n🎉 Done! Total blogs in database: ${finalCount.rows[0].count}`);
    console.log('✅ Test blogs are now in your Railway database!');
    
  } catch (error) {
    console.error('❌ Error inserting blogs:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
    process.exit(0);
  }
}

insertBlogs();

