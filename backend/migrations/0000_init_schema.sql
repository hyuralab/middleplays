-- Initialize Middleplays Database Schema (Clean Slate)
-- Trust-based marketplace untuk game accounts & digital goods

-- Create Enums
CREATE TYPE user_role AS ENUM ('user', 'seller', 'admin');
CREATE TYPE posting_status AS ENUM ('active', 'pending', 'sold', 'archived');
CREATE TYPE login_method AS ENUM ('email', 'google', 'apple');
CREATE TYPE transaction_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE dispute_status AS ENUM ('open', 'resolved', 'closed');
CREATE TYPE notification_type AS ENUM ('transaction', 'review', 'dispute', 'system');
CREATE TYPE trust_level AS ENUM ('new', 'verified', 'trusted', 'expert');

-->

-- Create Tables
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role user_role DEFAULT 'user',
  login_method login_method DEFAULT 'email',
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(255),
  bio TEXT,
  avatar_url VARCHAR(255),
  phone VARCHAR(20),
  country VARCHAR(100),
  city VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE email_verification_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE seller_stats (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_sales INTEGER DEFAULT 0,
  successful_transactions INTEGER DEFAULT 0,
  cancelled_transactions INTEGER DEFAULT 0,
  dispute_count INTEGER DEFAULT 0,
  average_rating NUMERIC(3,2) DEFAULT 0.00,
  trust_level trust_level DEFAULT 'new',
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE games (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  platform VARCHAR(100),
  genre VARCHAR(100),
  cover_image_url VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE game_field_definitions (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  field_name VARCHAR(255) NOT NULL,
  field_type VARCHAR(50),
  is_required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE game_accounts (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  account_identifier VARCHAR(255),
  status posting_status DEFAULT 'pending',
  price NUMERIC(12,2) NOT NULL,
  description TEXT,
  field_values JSONB,
  cover_image_url VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_account_id INTEGER NOT NULL REFERENCES game_accounts(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  status transaction_status DEFAULT 'pending',
  payment_status payment_status DEFAULT 'pending',
  payment_method VARCHAR(100),
  payment_id VARCHAR(255),
  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE disputes (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  initiated_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status dispute_status DEFAULT 'open',
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE favorites (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_account_id INTEGER NOT NULL REFERENCES game_accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_account_id)
);

CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title VARCHAR(255),
  message TEXT,
  related_id INTEGER,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewed_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE review_photos (
  id SERIAL PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  photo_url VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE review_responses (
  id SERIAL PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  responder_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  response TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-->

-- Create Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_email_verification_user_id ON email_verification_tokens(user_id);
CREATE INDEX idx_seller_stats_user_id ON seller_stats(user_id);
CREATE INDEX idx_game_field_definitions_game_id ON game_field_definitions(game_id);
CREATE INDEX idx_game_accounts_seller_id ON game_accounts(seller_id);
CREATE INDEX idx_game_accounts_game_id ON game_accounts(game_id);
CREATE INDEX idx_game_accounts_status ON game_accounts(status);
CREATE INDEX idx_transactions_buyer_id ON transactions(buyer_id);
CREATE INDEX idx_transactions_seller_id ON transactions(seller_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_payment_status ON transactions(payment_status);
CREATE INDEX idx_disputes_transaction_id ON disputes(transaction_id);
CREATE INDEX idx_disputes_status ON disputes(status);
CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_reviews_transaction_id ON reviews(transaction_id);
CREATE INDEX idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX idx_reviews_reviewed_user_id ON reviews(reviewed_user_id);
CREATE INDEX idx_review_photos_review_id ON review_photos(review_id);
CREATE INDEX idx_review_responses_review_id ON review_responses(review_id);

-->

-- Create Views
CREATE VIEW v_seller_profiles AS
  SELECT 
    u.id,
    u.username,
    u.email,
    up.full_name,
    up.avatar_url,
    up.phone,
    up.country,
    up.city,
    ss.total_sales,
    ss.successful_transactions,
    ss.dispute_count,
    ss.average_rating,
    ss.trust_level,
    ss.last_activity_at
  FROM users u
  LEFT JOIN user_profiles up ON u.id = up.user_id
  LEFT JOIN seller_stats ss ON u.id = ss.user_id
  WHERE u.role = 'seller';

CREATE VIEW v_active_listings AS
  SELECT 
    ga.id,
    ga.seller_id,
    ga.game_id,
    g.name AS game_name,
    ga.account_identifier,
    ga.price,
    ga.description,
    ga.cover_image_url,
    ga.created_at,
    u.username AS seller_username,
    ss.average_rating,
    ss.trust_level
  FROM game_accounts ga
  JOIN games g ON ga.game_id = g.id
  JOIN users u ON ga.seller_id = u.id
  LEFT JOIN seller_stats ss ON u.id = ss.user_id
  WHERE ga.status = 'active' AND u.is_verified = TRUE;

-->

-- Create Triggers (Auto-update updated_at)
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_update_timestamp BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER user_profiles_update_timestamp BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER seller_stats_update_timestamp BEFORE UPDATE ON seller_stats FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER games_update_timestamp BEFORE UPDATE ON games FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER game_accounts_update_timestamp BEFORE UPDATE ON game_accounts FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER transactions_update_timestamp BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER disputes_update_timestamp BEFORE UPDATE ON disputes FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER notifications_update_timestamp BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER reviews_update_timestamp BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER review_responses_update_timestamp BEFORE UPDATE ON review_responses FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-->

-- Sample Data
INSERT INTO games (name, description, platform, genre) VALUES
('Mobile Legends', 'Strategic team-based MOBA for mobile', 'Mobile', 'MOBA'),
('Genshin Impact', 'Open-world action RPG', 'Multi-platform', 'RPG'),
('Valorant', 'Tactical 5v5 team shooter', 'PC', 'FPS');

INSERT INTO game_field_definitions (game_id, field_name, field_type, is_required) VALUES
(1, 'Server Region', 'text', TRUE),
(1, 'Account Level', 'number', TRUE),
(2, 'AR Level', 'number', FALSE),
(3, 'Rank', 'text', FALSE);
