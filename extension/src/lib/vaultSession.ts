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
  type WrappedDekBlob,
  deriveMasterKey,
  fromBase64,
  parseWrappedDekJson,
  toBase64,
  unwrapDek,
  verifyMasterPasswordAuth,
  wrapDek,
} from "@vaultlock/shared/crypto";

import { clearWrappedDek, loadWrappedDek, saveWrappedDek } from "./storage";
import { applyUnlockedDek, clearUnlockedDek } from "./vaultDekLifecycle";
import { getDataEncryptionKey, isVaultUnlocked } from "./vaultDekState";

export { getDataEncryptionKey, isVaultUnlocked };

/**
 * Sets the Data Encryption Key after successful unlock / derivation.
 */
export function setDataEncryptionKey(dek: Uint8Array): void {
  clearUnlockedDek();
  applyUnlockedDek(dek);
}

async function tryUnwrapWrappedDek(
  blob: WrappedDekBlob,
  masterKey: Uint8Array,
): Promise<Uint8Array | null> {
  try {
    return await unwrapDek(fromBase64(blob.nonce), fromBase64(blob.ciphertext), masterKey);
  } catch {
    return null;
  }
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
    const serverBlob = parseWrappedDekJson(params.wrappedDekFromServer);
    const localRecord = await loadWrappedDek(normalizedEmail);
    const localBlob = localRecord
      ? { nonce: localRecord.nonce, ciphertext: localRecord.ciphertext }
      : null;

    const candidates: { source: "server" | "local"; blob: WrappedDekBlob }[] = [];
    if (serverBlob) {
      candidates.push({ source: "server", blob: serverBlob });
    }
    if (
      localBlob &&
      (!serverBlob ||
        localBlob.nonce !== serverBlob.nonce ||
        localBlob.ciphertext !== serverBlob.ciphertext)
    ) {
      candidates.push({ source: "local", blob: localBlob });
    }

    for (const { source, blob } of candidates) {
      const dek = await tryUnwrapWrappedDek(blob, masterKey);
      if (dek) {
        await saveWrappedDek(normalizedEmail, blob.nonce, blob.ciphertext);
        applyUnlockedDek(dek);
        return { generatedNewDek: false };
      }
    }

    if (serverBlob) {
      throw new Error(
        "Could not unlock your vault encryption key from the server. " +
          "Open VaultLock on the desktop app, unlock once, then sign out and sign in again here.",
      );
    }

    const dek = crypto.getRandomValues(new Uint8Array(32));
    const { nonce, ciphertext } = await wrapDek(dek, masterKey);
    await saveWrappedDek(normalizedEmail, toBase64(nonce), toBase64(ciphertext));

    applyUnlockedDek(dek);

    return { generatedNewDek: true };
  } finally {
    masterKey.fill(0);
  }
}

export function lockVault(): void {
  clearUnlockedDek();
}

/**
 * Restores a DEK (used for quick unlock / biometric flows later).
 */
export function restoreUnlockedDek(dek: Uint8Array): void {
  applyUnlockedDek(dek);
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
