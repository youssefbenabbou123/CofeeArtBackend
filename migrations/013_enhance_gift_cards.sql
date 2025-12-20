-- Enhance gift_cards table with category, used status, and purchaser info
ALTER TABLE gift_cards 
  ADD COLUMN IF NOT EXISTS category VARCHAR(50),
  ADD COLUMN IF NOT EXISTS used BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS purchaser_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS purchaser_email VARCHAR(150),
  ADD COLUMN IF NOT EXISTS purchaser_name VARCHAR(150);

-- Update status to include 'used' and 'expired'
-- Status values: 'active' (unused), 'used', 'expired'
ALTER TABLE gift_cards 
  ALTER COLUMN status SET DEFAULT 'active';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_gift_cards_category ON gift_cards(category);
CREATE INDEX IF NOT EXISTS idx_gift_cards_used ON gift_cards(used);
CREATE INDEX IF NOT EXISTS idx_gift_cards_purchaser ON gift_cards(purchaser_id);

-- Function to automatically set expiry_date to 1 year from creation if not set
CREATE OR REPLACE FUNCTION set_gift_card_expiry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expiry_date IS NULL THEN
    NEW.expiry_date := (NEW.created_at + INTERVAL '1 year')::DATE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set expiry date on insert
DROP TRIGGER IF EXISTS trigger_set_gift_card_expiry ON gift_cards;
CREATE TRIGGER trigger_set_gift_card_expiry
  BEFORE INSERT ON gift_cards
  FOR EACH ROW
  EXECUTE FUNCTION set_gift_card_expiry();

-- Function to check and update expired cards
CREATE OR REPLACE FUNCTION check_expired_gift_cards()
RETURNS void AS $$
BEGIN
  UPDATE gift_cards
  SET status = 'expired', used = true
  WHERE expiry_date < CURRENT_DATE
    AND status = 'active'
    AND used = false;
END;
$$ LANGUAGE plpgsql;


