-- Add guest order fields to orders table
-- Allow NULL user_id for guest orders
ALTER TABLE orders 
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS guest_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS guest_email VARCHAR(150),
  ADD COLUMN IF NOT EXISTS guest_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS shipping_address TEXT,
  ADD COLUMN IF NOT EXISTS shipping_city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS shipping_postal_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS shipping_country VARCHAR(100) DEFAULT 'France';

-- Update order_items to work with products directly (not just variants)
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id),
  ALTER COLUMN product_variant_id DROP NOT NULL;

