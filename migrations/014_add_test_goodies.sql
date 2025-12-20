-- Add test goodies/lifestyle products
-- Tote bags
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM products WHERE title = 'Tote Bag Coffee Arts') THEN
    INSERT INTO products (title, description, price, image, category, status)
    VALUES (
      'Tote Bag Coffee Arts',
      'Tote bag en coton bio avec notre logo Coffee Arts. Parfait pour vos courses ou vos sorties. Dimensions: 40x42 cm. Lavable en machine.',
      25.00,
      '/boutique/tote-bag-coffee-arts.jpg',
      'Tote bags',
      'active'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE title = 'Tote Bag Céramique') THEN
    INSERT INTO products (title, description, price, image, category, status)
    VALUES (
      'Tote Bag Céramique',
      'Tote bag élégant avec motif céramique. Matériau durable et écologique. Dimensions: 38x40 cm. Idéal pour transporter vos créations ou vos affaires.',
      28.00,
      '/boutique/tote-bag-ceramique.jpg',
      'Tote bags',
      'active'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE title = 'Tote Bag Minimaliste') THEN
    INSERT INTO products (title, description, price, image, category, status)
    VALUES (
      'Tote Bag Minimaliste',
      'Tote bag sobre et minimaliste, parfait pour un usage quotidien. Coton épais et résistant. Dimensions: 35x38 cm.',
      22.00,
      '/boutique/tote-bag-minimaliste.jpg',
      'Tote bags',
      'active'
    );
  END IF;
END $$;

-- Affiches / prints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM products WHERE title = 'Affiche Coffee Arts') THEN
    INSERT INTO products (title, description, price, image, category, status)
    VALUES (
      'Affiche Coffee Arts',
      'Affiche design représentant notre univers café et céramique. Impression haute qualité sur papier premium. Format A3 (29.7 x 42 cm). Parfait pour décorer votre intérieur.',
      35.00,
      '/boutique/affiche-coffee-arts.jpg',
      'Affiches / prints',
      'active'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE title = 'Print Céramique Moderne') THEN
    INSERT INTO products (title, description, price, image, category, status)
    VALUES (
      'Print Céramique Moderne',
      'Print artistique mettant en valeur l''art de la céramique. Design contemporain et élégant. Format A4 (21 x 29.7 cm). Encadrement non inclus.',
      18.00,
      '/boutique/print-ceramique-moderne.jpg',
      'Affiches / prints',
      'active'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE title = 'Affiche Café de Spécialité') THEN
    INSERT INTO products (title, description, price, image, category, status)
    VALUES (
      'Affiche Café de Spécialité',
      'Affiche illustrée dédiée aux amateurs de café. Design vintage et chaleureux. Format A3 (29.7 x 42 cm). Impression sur papier mat premium.',
      32.00,
      '/boutique/affiche-cafe-specialite.jpg',
      'Affiches / prints',
      'active'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE title = 'Print Minimaliste') THEN
    INSERT INTO products (title, description, price, image, category, status)
    VALUES (
      'Print Minimaliste',
      'Print minimaliste avec typographie élégante. Parfait pour un intérieur moderne. Format A4 (21 x 29.7 cm). Disponible en plusieurs couleurs.',
      20.00,
      '/boutique/print-minimaliste.jpg',
      'Affiches / prints',
      'active'
    );
  END IF;
END $$;

