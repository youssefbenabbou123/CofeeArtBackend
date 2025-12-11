-- Add updated_at column to orders table if it doesn't exist
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();

-- Create index for updated_at
CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON orders(updated_at DESC);

