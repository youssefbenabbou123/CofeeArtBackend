-- Add Square payment ID column to orders table
-- Migration from Stripe to Square

ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS square_payment_id VARCHAR(255);

-- Create index for Square payment ID
CREATE INDEX IF NOT EXISTS idx_orders_square_payment_id ON orders(square_payment_id);





