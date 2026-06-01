-- Add wrapped_dek column to users for secure cross-device DEK sharing.
-- The value is the user's random DEK, encrypted with their master key (derived from password).
-- Server stores only ciphertext; it cannot decrypt vault items.
-- Clients upload this on first unlock for an account.
-- New devices receive it in the login response and unwrap locally.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS wrapped_dek JSONB NULL;

COMMENT ON COLUMN users.wrapped_dek IS 
'Wrapped Data Encryption Key (DEK encrypted with user master key). Enables zero-knowledge multi-device access. Clients are responsible for uploading on first device and using on subsequent devices.';
