/**
 * Vault session / key management for the browser extension.
 *
 * Manages the in-memory Data Encryption Key (DEK) after the user unlocks
 * with their master password.
 *
 * This is the extension equivalent of desktop/src/lib/vaultSession.ts.
 * We keep it minimal for 12-03 (crypto integration) and will expand it
 * in 12-04 (Auth + unlock) with actual derivation + wrapped DEK storage.
 */

let dataEncryptionKey: Uint8Array | null = null;

/**
 * Returns whether the vault is currently unlocked (DEK is in memory).
 */
export function isVaultUnlocked(): boolean {
  return dataEncryptionKey !== null;
}

/**
 * Gets the current Data Encryption Key.
 * Throws if the vault is locked.
 */
export function getDataEncryptionKey(): Uint8Array {
  if (!dataEncryptionKey) {
    throw new Error("Vault is locked. Master password unlock required.");
  }
  return dataEncryptionKey;
}

/**
 * Sets the Data Encryption Key after successful unlock / derivation.
 * This should only be called from the unlock flow (12-04).
 */
export function setDataEncryptionKey(dek: Uint8Array): void {
  lockVault(); // Clear any previous key
  dataEncryptionKey = new Uint8Array(dek); // Copy to avoid external mutation
}

/**
 * Locks the vault by clearing the in-memory DEK.
 * Should be called on lock, sign out, or when the session ends.
 */
export function lockVault(): void {
  if (dataEncryptionKey) {
    dataEncryptionKey.fill(0);
  }
  dataEncryptionKey = null;
}

/**
 * Restores a previously derived DEK (used for biometric/quick unlock flows later).
 */
export function restoreUnlockedDek(dek: Uint8Array): void {
  lockVault();
  dataEncryptionKey = new Uint8Array(dek);
}
