import { argon2id } from "hash-wasm";

/** Matches backend `backend/src/crypto/argon2.rs` interactive login parameters. */
export const ARGON2_INTERACTIVE_PARAMS = {
  memorySize: 19456,
  iterations: 2,
  parallelism: 1,
  hashLength: 32,
} as const;

const SALT_BYTES = 16;

function randomSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

/** Normalized email bytes used as Argon2 salt for master key derivation (16 bytes). */
export function emailSalt(email: string): Uint8Array {
  const normalized = email.trim().toLowerCase();
  const encoded = new TextEncoder().encode(normalized);
  const salt = new Uint8Array(SALT_BYTES);
  salt.set(encoded.slice(0, SALT_BYTES));
  return salt;
}

/**
 * Produces an Argon2id PHC string for register/login (`master_password_hash`).
 * Server validates prefix `$argon2id$`.
 */
export async function hashMasterPasswordAuth(masterPassword: string): Promise<string> {
  const salt = randomSalt();
  return argon2id({
    password: masterPassword,
    salt,
    ...ARGON2_INTERACTIVE_PARAMS,
    outputType: "encoded",
  });
}

/**
 * Derives a 32-byte master key from master password + email (vault encryption KDF).
 */
export async function deriveMasterKey(masterPassword: string, email: string): Promise<Uint8Array> {
  const hash = await argon2id({
    password: masterPassword,
    salt: emailSalt(email),
    ...ARGON2_INTERACTIVE_PARAMS,
    outputType: "binary",
  });
  return new Uint8Array(hash);
}
