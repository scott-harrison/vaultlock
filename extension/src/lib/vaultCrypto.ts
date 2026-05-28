/**
 * Vault crypto helpers for the browser extension.
 *
 * This module provides a thin, extension-friendly wrapper around
 * @vaultlock/shared/crypto for encrypting and decrypting vault items.
 *
 * It follows the same patterns as the desktop app (see desktop/src/lib/vaultCrypto.ts).
 */

import { decryptJsonPayloadBase64, encryptJsonPayloadBase64 } from "@vaultlock/shared/crypto";
import type { VaultItemPlaintext, VaultItemResponse } from "@vaultlock/shared/types";

import { getDataEncryptionKey } from "./vaultSession";

/**
 * Decrypts a vault item response from the server.
 */
export async function decryptVaultItem(item: VaultItemResponse): Promise<VaultItemPlaintext> {
  const dek = getDataEncryptionKey();
  return decryptJsonPayloadBase64<VaultItemPlaintext>(item.encrypted_data, item.nonce, dek);
}

/**
 * Encrypts a plaintext vault item before sending it to the server.
 */
export async function encryptVaultItemPlaintext(
  plaintext: VaultItemPlaintext,
): Promise<{ encrypted_data: string; nonce: string }> {
  const dek = getDataEncryptionKey();
  return encryptJsonPayloadBase64(plaintext, dek);
}
