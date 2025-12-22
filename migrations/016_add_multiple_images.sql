-- Add support for multiple images for products and workshops
-- Store images as JSON array, keep 'image' column for backward compatibility (first image)

-- Add images column to products (JSON array)
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- Migrate existing single image to images array
UPDATE products 
SET images = jsonb_build_array(image)
WHERE image IS NOT NULL AND (images IS NULL OR images = '[]'::jsonb);

-- Add images column to workshops (JSON array)
ALTER TABLE workshops 
  ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- Migrate existing single image to images array
UPDATE workshops 
SET images = jsonb_build_array(image)
WHERE image IS NOT NULL AND (images IS NULL OR images = '[]'::jsonb);

-- Create index for better performance when querying images
CREATE INDEX IF NOT EXISTS idx_products_images ON products USING GIN (images);
CREATE INDEX IF NOT EXISTS idx_workshops_images ON workshops USING GIN (images);

