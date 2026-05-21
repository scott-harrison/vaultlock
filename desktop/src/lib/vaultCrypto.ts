import { decryptJsonPayloadBase64, encryptJsonPayloadBase64 } from "@vaultlock/shared/crypto";
import type { VaultItemPlaintext, VaultItemResponse } from "@vaultlock/shared/types";
import { getDataEncryptionKey } from "./vaultSession";

export async function decryptVaultItem(item: VaultItemResponse): Promise<VaultItemPlaintext> {
  const dek = getDataEncryptionKey();
  return decryptJsonPayloadBase64<VaultItemPlaintext>(item.encrypted_data, item.nonce, dek);
}

export async function encryptVaultItemPlaintext(
  plaintext: VaultItemPlaintext,
): Promise<{ encrypted_data: string; nonce: string }> {
  const dek = getDataEncryptionKey();
  return encryptJsonPayloadBase64(plaintext, dek);
}
