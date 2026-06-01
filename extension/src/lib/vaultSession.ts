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

export async function unlockVault(params: {
  email: string;
  masterPassword: string;
  masterPasswordHash: string;
  wrappedDekFromServer?: Record<string, unknown>;
}): Promise<{ generatedNewDek: boolean }> {
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
    let dek: Uint8Array | null = null;

    const local = await loadWrappedDek(normalizedEmail);
    const fromServer = params.wrappedDekFromServer as
      | { nonce?: string; ciphertext?: string }
      | undefined;

    const candidate =
      local ??
      (fromServer?.nonce && fromServer?.ciphertext
        ? { nonce: fromServer.nonce, ciphertext: fromServer.ciphertext }
        : null);

    if (candidate) {
      try {
        dek = await unwrapDek(
          fromBase64(candidate.nonce),
          fromBase64(candidate.ciphertext),
          masterKey,
        );

        // Persist the wrapped_dek locally if it came from the server
        // (so we don't need the server response on every future unlock on this device).
        if (!local && fromServer?.nonce && fromServer?.ciphertext) {
          await saveWrappedDek(normalizedEmail, candidate.nonce, candidate.ciphertext);
        }
      } catch {
        dek = null;
      }
    }

    let generatedNewDek = false;

    if (!dek) {
      dek = crypto.getRandomValues(new Uint8Array(32));
      const { nonce, ciphertext } = await wrapDek(dek, masterKey);
      await saveWrappedDek(normalizedEmail, toBase64(nonce), toBase64(ciphertext));
      generatedNewDek = true;
    }

    lockVault();
    dataEncryptionKey = dek;

    return { generatedNewDek };
  } finally {
    masterKey.fill(0);
  }
}

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
 * Returns the currently wrapped DEK record from local storage for the given email.
 * Useful for uploading to the server after first unlock on a device.
 */
export async function getCurrentWrappedDek(email: string) {
  return loadWrappedDek(email);
}

/**
 * Clears the wrapped DEK from storage (used on sign out or server change).
 */
export async function clearWrappedDekStorage(): Promise<void> {
  lockVault();
  await clearWrappedDek();
}
