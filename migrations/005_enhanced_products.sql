-- Enhanced Products Migration
-- Add stock, TVA, collections, and archive functionality

-- Add stock management fields
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS stock INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_alert_threshold INT DEFAULT 10;

-- Add TVA and pricing fields
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS tva_rate DECIMAL(5,2) DEFAULT 20.00,
  ADD COLUMN IF NOT EXISTS price_ht DECIMAL(10,2);

-- Add collection and archive
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS collection VARCHAR(100),
  ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- Enhance product_variants
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS color VARCHAR(50),
  ADD COLUMN IF NOT EXISTS size VARCHAR(50),
  ADD COLUMN IF NOT EXISTS flavor VARCHAR(50);

-- Create product_collections table
CREATE TABLE IF NOT EXISTS product_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  image TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Create indexes for performance (after columns are added)
-- These will be created after all ALTER TABLE statements complete

