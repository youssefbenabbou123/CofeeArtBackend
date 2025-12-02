-- Contact Messages Table
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

-- Site Settings Table
CREATE TABLE IF NOT EXISTS site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMP DEFAULT now()
);

-- Add category column to products table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'category'
  ) THEN
    ALTER TABLE products ADD COLUMN category VARCHAR(100);
  END IF;
END $$;

-- Add status column to products table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'status'
  ) THEN
    ALTER TABLE products ADD COLUMN status VARCHAR(20) DEFAULT 'active';
  END IF;
END $$;

-- Insert default site settings
INSERT INTO site_settings (key, value) VALUES
  ('site_name', 'Coffee Arts Paris'),
  ('site_description', 'Un espace hybride unique où la créativité rencontre la dégustation'),
  ('contact_email', 'hello@coffeearts.fr'),
  ('contact_phone', '+33 1 42 55 66 77'),
  ('instagram_url', ''),
  ('facebook_url', ''),
  ('twitter_url', '')
ON CONFLICT (key) DO NOTHING;

