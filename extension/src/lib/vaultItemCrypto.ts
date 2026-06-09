/**
 * Vault item encrypt/decrypt without Argon2 (safe for the background worker).
 */
import { decrypt, encrypt, fromBase64, toBase64 } from "@vaultlock/shared/crypto/aes";
import type { VaultItemPlaintext, VaultItemResponse } from "@vaultlock/shared/types";
import { getDataEncryptionKey } from "./vaultDekState";

export async function decryptVaultItem(item: VaultItemResponse): Promise<VaultItemPlaintext> {
  const dek = getDataEncryptionKey();
  const plaintext = await decrypt(fromBase64(item.nonce), fromBase64(item.encrypted_data), dek);
  return JSON.parse(new TextDecoder().decode(plaintext)) as VaultItemPlaintext;
}

export async function encryptVaultItemPlaintext(
  plaintext: VaultItemPlaintext,
): Promise<{ encrypted_data: string; nonce: string }> {
  const dek = getDataEncryptionKey();
  const payload = new TextEncoder().encode(JSON.stringify(plaintext));
  const { nonce, ciphertext } = await encrypt(payload, dek);
  return {
    encrypted_data: toBase64(ciphertext),
    nonce: toBase64(nonce),
  };
}
