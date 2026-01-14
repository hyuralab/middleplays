-- Add Google OAuth columns to users table

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'google_id'
  ) THEN
    ALTER TABLE users ADD COLUMN google_id VARCHAR(255) UNIQUE;
    ALTER TABLE users ADD COLUMN google_name VARCHAR(255);
    ALTER TABLE users ADD COLUMN google_avatar_url VARCHAR(512);
  END IF;
END $$;

-- Create index on google_id for faster lookups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'users' AND indexname = 'idx_users_google_id'
  ) THEN
    CREATE INDEX idx_users_google_id ON users(google_id);
  END IF;
END $$;

-- Remove old authentication columns (if they exist)
-- First drop dependent views
DROP VIEW IF EXISTS v_active_listings CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE users DROP COLUMN password_hash;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'is_verified'
  ) THEN
    ALTER TABLE users DROP COLUMN is_verified;
  END IF;
END $$;

-- Drop old email verification table (if it exists)
DROP TABLE IF EXISTS email_verification_tokens;

-- Update login_method to 'google' as default for new logins
-- Note: Existing users will keep their 'email' login_method until they migrate
