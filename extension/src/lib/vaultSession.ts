/**
 * Vault session / key management for the browser extension.
 *
 * Handles master password verification, master key derivation (Argon2id),
 * DEK unwrapping/wrapping, and in-memory DEK lifecycle.
 *
 * This mirrors the desktop implementation (desktop/src/lib/vaultSession.ts)
 * but uses the extension storage layer.
 */

import {
  deriveMasterKey,
  fromBase64,
  toBase64,
  unwrapDek,
  verifyMasterPasswordAuth,
  wrapDek,
} from "@vaultlock/shared/crypto";

import { clearWrappedDek, loadWrappedDek, saveWrappedDek } from "./storage";

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
 */
export function setDataEncryptionKey(dek: Uint8Array): void {
  lockVault();
  dataEncryptionKey = new Uint8Array(dek);
}

/**
 * Main unlock function.
 * Verifies the master password, derives the master key, unwraps (or creates) the DEK,
 * and keeps the DEK in memory.
 */
export async function unlockVault(params: {
  email: string;
  masterPassword: string;
  masterPasswordHash: string;
}): Promise<void> {
  const passwordValid = await verifyMasterPasswordAuth(
    params.masterPassword,
    params.masterPasswordHash,
  );

  if (!passwordValid) {
    throw new Error("Invalid master password");
  }

  const normalizedEmail = params.email.trim().toLowerCase();
  const masterKey = await deriveMasterKey(params.masterPassword, normalizedEmail);

  try {
    const existing = await loadWrappedDek(normalizedEmail);
    let dek: Uint8Array;

    if (existing) {
      try {
        dek = await unwrapDek(
          fromBase64(existing.nonce),
          fromBase64(existing.ciphertext),
          masterKey,
        );
      } catch {
        throw new Error("Local vault keys could not be decrypted. Sign out and sign in again.");
      }
    } else {
      // First time unlock on this device — generate a new DEK
      dek = crypto.getRandomValues(new Uint8Array(32));
      const { nonce, ciphertext } = await wrapDek(dek, masterKey);
      await saveWrappedDek(normalizedEmail, toBase64(nonce), toBase64(ciphertext));
    }

    lockVault();
    dataEncryptionKey = dek;
  } finally {
    // Always zeroize the master key from memory
    masterKey.fill(0);
  }
}

/**
 * Locks the vault by clearing the in-memory DEK.
 */
export function lockVault(): void {
  if (dataEncryptionKey) {
    dataEncryptionKey.fill(0);
  }
  dataEncryptionKey = null;
}

/**
 * Restores a DEK (used for quick unlock / biometric flows later).
 */
export function restoreUnlockedDek(dek: Uint8Array): void {
  lockVault();
  dataEncryptionKey = new Uint8Array(dek);
}

/**
 * Clears the wrapped DEK from storage (used on sign out or server change).
 */
export async function clearWrappedDekStorage(): Promise<void> {
  lockVault();
  await clearWrappedDek();
}
