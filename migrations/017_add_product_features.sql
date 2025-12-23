-- Add features/characteristics field to products table
-- Store features as JSON array

ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb;

-- Create index for better performance when querying features
CREATE INDEX IF NOT EXISTS idx_products_features ON products USING GIN (features);


