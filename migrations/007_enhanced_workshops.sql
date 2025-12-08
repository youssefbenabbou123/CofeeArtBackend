-- Enhanced Workshops Migration
-- Add level, duration, image, status, and session management

ALTER TABLE workshops 
  ADD COLUMN IF NOT EXISTS level VARCHAR(20) DEFAULT 'débutant',
  ADD COLUMN IF NOT EXISTS duration INT DEFAULT 120,
  ADD COLUMN IF NOT EXISTS image TEXT,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Enhance reservations for guest bookings
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS guest_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS guest_email VARCHAR(150),
  ADD COLUMN IF NOT EXISTS guest_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS waitlist_position INT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Create workshop_sessions table for multiple dates/times
CREATE TABLE IF NOT EXISTS workshop_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id UUID REFERENCES workshops(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  session_time TIME NOT NULL,
  capacity INT NOT NULL,
  booked_count INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT now()
);

-- Update reservations to link to sessions
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES workshop_sessions(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_workshops_status ON workshops(status);
CREATE INDEX IF NOT EXISTS idx_workshops_level ON workshops(level);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_workshop_sessions_date ON workshop_sessions(session_date);

