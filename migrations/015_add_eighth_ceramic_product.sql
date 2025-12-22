-- Add eighth ceramic product to fill the gap in boutique page
-- Plateau Céramique - Collection spéciale

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM products WHERE title = 'Plateau Céramique Artisanal') THEN
    INSERT INTO products (title, description, price, image, category, status)
    VALUES (
      'Plateau Céramique Artisanal',
      'Un plateau céramique élégant et fonctionnel, parfait pour servir vos thés, cafés ou petits déjeuners. Design minimaliste aux lignes épurées, fabriqué à la main par nos céramistes. Dimensions: 35x25 cm. Idéal pour créer un moment de convivialité raffiné.',
      48.00,
      '/boutique/plateau-ceramique-artisanal.jpg',
      'Plateaux',
      'active'
    );
  END IF;
END $$;

