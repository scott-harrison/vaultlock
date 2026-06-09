/**
 * In-memory DEK holder without Argon2 / WASM dependencies.
 * Safe to import from the background service worker.
 */

let dataEncryptionKey: Uint8Array | null = null;

export function isVaultUnlocked(): boolean {
  return dataEncryptionKey !== null;
}

export function getDataEncryptionKey(): Uint8Array {
  if (!dataEncryptionKey) {
    throw new Error("Vault is locked. Master password unlock required.");
  }
  return dataEncryptionKey;
}

export function restoreUnlockedDek(dek: Uint8Array): void {
  if (dataEncryptionKey) {
    dataEncryptionKey.fill(0);
  }
  dataEncryptionKey = new Uint8Array(dek);
}

export function lockVaultDek(): void {
  if (dataEncryptionKey) {
    dataEncryptionKey.fill(0);
  }
  dataEncryptionKey = null;
}
