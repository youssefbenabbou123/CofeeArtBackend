-- Create product_categories table for custom categories
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- Insert default categories
INSERT INTO product_categories (name) VALUES
  ('Tasses'),
  ('Assiettes'),
  ('Pièces uniques'),
  ('Collections spéciales'),
  ('Tote bags'),
  ('Affiches / prints')
ON CONFLICT (name) DO NOTHING;

-- Create index
CREATE INDEX IF NOT EXISTS idx_product_categories_name ON product_categories(name);

