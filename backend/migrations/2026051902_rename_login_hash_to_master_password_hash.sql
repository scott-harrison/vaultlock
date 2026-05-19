-- Rename login_hash to master_password_hash for zero-knowledge API clarity.
-- Values remain Argon2id PHC strings; only the column name changes.
ALTER TABLE users RENAME COLUMN login_hash TO master_password_hash;
