-- Add credential access tracking for temporary viewing
-- Credentials expire 10 minutes after first fetch
-- Auto-delete credentials after 1 hour

CREATE TABLE credential_access (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_credential_access_transaction ON credential_access(transaction_id);
CREATE INDEX idx_credential_access_buyer ON credential_access(buyer_id);
CREATE INDEX idx_credential_access_expires ON credential_access(expires_at);

-- Add column to track if credentials have been viewed
ALTER TABLE transactions ADD COLUMN credentials_first_accessed_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN credentials_expires_at TIMESTAMPTZ;
