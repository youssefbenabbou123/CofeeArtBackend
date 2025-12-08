import pool from './db.js';
import dotenv from 'dotenv';

dotenv.config();

const testBlogs = [
  {
    title: "Les Secrets de la Céramique Japonaise",
    content: `La céramique japonaise est un art millénaire qui fascine par sa simplicité et son élégance. Dans cet article, nous explorons les techniques ancestrales qui font la beauté unique de cette tradition.

<h2>L'Histoire de la Céramique Japonaise</h2>
<p>La céramique japonaise remonte à plus de 10 000 ans. Les premières poteries, appelées Jomon, étaient décorées avec des motifs cordés. Au fil des siècles, différentes techniques se sont développées, chacune avec ses caractéristiques propres.</p>

<h2>Les Techniques Principales</h2>
<p>Parmi les techniques les plus célèbres, on trouve :</p>
<ul>
  <li><strong>Raku</strong> : Une technique de cuisson rapide qui crée des effets uniques</li>
  <li><strong>Kintsugi</strong> : L'art de réparer avec de l'or, transformant les fissures en beauté</li>
  <li><strong>Shino</strong> : Un glaçage blanc épais qui crée des textures remarquables</li>
</ul>

<h2>L'Esprit Wabi-Sabi</h2>
<p>La céramique japonaise incarne l'esthétique wabi-sabi, qui célèbre l'imperfection et la beauté de l'éphémère. Chaque pièce raconte une histoire unique, avec ses imperfections qui la rendent parfaite.</p>

<h2>Conclusion</h2>
<p>Apprendre la céramique japonaise, c'est s'immerger dans une philosophie de vie qui prône la simplicité, l'authenticité et la beauté dans l'imperfection.</p>`,
    excerpt: "Découvrez les techniques millénaires qui font la beauté de la céramique japonaise.",
    author: "Marie Dubois",
    category: "Techniques",
    published: true,
  },
  {
    title: "Guide Complet: Bien Choisir sa Tasse",
    content: `Choisir la bonne tasse peut transformer votre expérience de dégustation. Voici un guide complet pour trouver la tasse parfaite.

<h2>La Forme et la Taille</h2>
<p>La forme de votre tasse influence la façon dont vous percevez les arômes. Une tasse large permet aux arômes de se développer, tandis qu'une tasse étroite concentre les saveurs.</p>

<h2>Le Matériau</h2>
<p>La céramique offre une excellente rétention de chaleur et ne modifie pas le goût. Choisissez une céramique de qualité pour une expérience optimale.</p>

<h2>L'Épaisseur</h2>
<p>Une tasse épaisse garde le café chaud plus longtemps, tandis qu'une tasse fine offre une sensation plus délicate en bouche.</p>

<h2>Le Design</h2>
<p>Au-delà de la fonctionnalité, choisissez une tasse qui vous inspire et qui s'harmonise avec votre espace. La beauté de l'objet fait partie de l'expérience.</p>

<h2>Conseils Pratiques</h2>
<ul>
  <li>Testez différentes formes pour découvrir vos préférences</li>
  <li>Investissez dans une tasse de qualité qui durera des années</li>
  <li>Choisissez une taille adaptée à votre consommation</li>
</ul>`,
    excerpt: "Tous nos conseils pour sélectionner la tasse parfaite selon votre style et vos préférences.",
    author: "Pierre Martin",
    category: "Conseils",
    published: true,
  },
  {
    title: "Peinture et Glaçure: L'Art Décoratif",
    content: `La décoration est l'étape qui transforme une simple pièce de céramique en œuvre d'art. Explorons les différentes techniques.

<h2>Les Techniques de Peinture</h2>
<p>La peinture sous glaçure permet de créer des motifs durables qui résistent à l'usure. Les pigments sont appliqués avant la cuisson finale.</p>

<h2>Les Glaçures</h2>
<p>Le glaçage protège la céramique et ajoute une dimension esthétique. Chaque type de glaçure offre un fini unique : mat, brillant, texturé...</p>

<h2>Les Couleurs</h2>
<p>Le choix des couleurs est crucial. Les tons terre évoquent la nature, tandis que les couleurs vives apportent de la modernité.</p>

<h2>Les Motifs</h2>
<p>Des motifs géométriques aux illustrations florales, les possibilités sont infinies. Laissez libre cours à votre créativité !</p>`,
    excerpt: "Explorez les différentes techniques de décoration pour sublimer vos créations céramiques.",
    author: "Sophie Laurent",
    category: "Art",
    published: true,
  },
  {
    title: "Durabilité: La Céramique Écologique",
    content: `La céramique est un choix écologique par excellence. Découvrez pourquoi et comment l'intégrer dans un mode de vie durable.

<h2>Un Matériau Naturel</h2>
<p>La céramique est fabriquée à partir d'argile, une ressource naturelle abondante. Contrairement au plastique, elle ne libère pas de produits chimiques.</p>

<h2>Durabilité Exceptionnelle</h2>
<p>Une pièce de céramique bien entretenue peut durer des générations. C'est un investissement à long terme qui réduit les déchets.</p>

<h2>Recyclabilité</h2>
<p>Même cassée, la céramique peut être recyclée ou réparée avec des techniques comme le kintsugi, prolongeant ainsi sa vie.</p>

<h2>Impact Environnemental</h2>
<p>En choisissant la céramique artisanale locale, vous réduisez l'empreinte carbone et soutenez l'économie locale.</p>

<h2>Conseils pour un Mode de Vie Durable</h2>
<ul>
  <li>Privilégiez les pièces artisanales locales</li>
  <li>Entretenez vos pièces pour les faire durer</li>
  <li>Réparez plutôt que jeter</li>
  <li>Choisissez des pièces intemporelles</li>
</ul>`,
    excerpt: "Pourquoi la céramique est le choix idéal pour un mode de vie durable.",
    author: "Jean Rousseau",
    category: "Écologie",
    published: true,
  },
  {
    title: "Café & Céramique: L'Accord Parfait",
    content: `La forme de votre tasse influence directement la dégustation de votre café. Découvrez comment optimiser cette expérience.

<h2>La Science de la Dégustation</h2>
<p>La forme de la tasse affecte la température, l'aération et la perception des arômes. Chaque type de café mérite sa tasse idéale.</p>

<h2>Les Différentes Formes</h2>
<ul>
  <li><strong>Tasse évasée</strong> : Parfaite pour les cafés légers, elle permet aux arômes de se développer</li>
  <li><strong>Tasse étroite</strong> : Idéale pour les espressos, elle concentre les saveurs intenses</li>
  <li><strong>Tasse large</strong> : Parfaite pour les cappuccinos, elle offre de l'espace pour la mousse</li>
</ul>

<h2>La Température</h2>
<p>La céramique maintient la température idéale plus longtemps que d'autres matériaux, préservant ainsi tous les arômes.</p>

<h2>L'Expérience Sensorielle</h2>
<p>Tenir une belle tasse en céramique fait partie intégrante de l'expérience. Le toucher, la vue, tout contribue au plaisir de la dégustation.</p>`,
    excerpt: "Comment la forme de votre tasse influence la dégustation de votre café préféré.",
    author: "Thomas Anderson",
    category: "Lifestyle",
    published: true,
  },
  {
    title: "Les Tendances Céramique 2025",
    content: `Découvrez les tendances qui marqueront l'année 2025 dans le monde de la céramique artisanale.

<h2>Minimalisme et Simplicité</h2>
<p>Le retour au minimalisme se confirme. Les formes épurées et les lignes simples sont à l'honneur, privilégiant la fonction et l'essentiel.</p>

<h2>Textures Brutes</h2>
<p>Les textures naturelles et brutes gagnent en popularité. On apprécie les imperfections, les traces de doigts, l'authenticité du matériau.</p>

<h2>Couleurs Terre</h2>
<p>Les tons terre, sable, terracotta dominent. Ces couleurs chaudes évoquent la nature et apportent une sensation de bien-être.</p>

<h2>Formes Organiques</h2>
<p>Les formes inspirées de la nature, asymétriques et fluides, remplacent les lignes droites rigides.</p>

<h2>Artisanat Local</h2>
<p>La valorisation de l'artisanat local et du fait-main continue de croître. Les consommateurs cherchent l'authenticité et l'histoire derrière chaque pièce.</p>

<h2>Conclusion</h2>
<p>2025 sera l'année de l'authenticité, de la simplicité et du retour aux sources. La céramique artisanale incarne parfaitement ces valeurs.</p>`,
    excerpt: "Minimalisme, textures brutes et couleurs terre : ce qui nous attend l'année prochaine.",
    author: "Sarah Connor",
    category: "Tendances",
    published: true,
  },
];

async function seedBlogs() {
  try {
    console.log('🌱 Starting blog seeding...');

    // Check if blogs already exist
    const existingBlogs = await pool.query('SELECT COUNT(*) FROM blog_posts');
    if (parseInt(existingBlogs.rows[0].count) > 0) {
      console.log('⚠️  Blogs already exist. Skipping seed.');
      return;
    }

    // Insert test blogs
    for (const blog of testBlogs) {
      const slug = blog.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      await pool.query(
        `INSERT INTO blog_posts (title, content, excerpt, author, category, slug, published) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [blog.title, blog.content, blog.excerpt, blog.author, blog.category, slug, blog.published]
      );

      console.log(`✅ Created blog: ${blog.title}`);
    }

    console.log('🎉 Blog seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding blogs:', error);
    process.exit(1);
  }
}

seedBlogs();

