ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS verification_token TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users (verification_token);
