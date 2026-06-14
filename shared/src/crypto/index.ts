import { decrypt, encrypt, fromBase64, toBase64 } from "./aes_gcm";

export * from "./aes_gcm";
export * from "./argon2";
export * from "./wrapped_dek";

export interface EncryptedVaultBlob {
  encryptedData: Uint8Array;
  nonce: Uint8Array;
}

export interface EncryptedVaultBlobBase64 {
  encrypted_data: string;
  nonce: string;
}

export async function encryptJsonPayload(
  payload: unknown,
  dek: Uint8Array,
): Promise<EncryptedVaultBlob> {
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const { nonce, ciphertext } = await encrypt(plaintext, dek);
  return { encryptedData: ciphertext, nonce };
}

export async function decryptJsonPayload<T>(
  encryptedData: Uint8Array,
  nonce: Uint8Array,
  dek: Uint8Array,
): Promise<T> {
  const plaintext = await decrypt(nonce, encryptedData, dek);
  const json = new TextDecoder().decode(plaintext);
  return JSON.parse(json) as T;
}

export async function encryptJsonPayloadBase64(
  payload: unknown,
  dek: Uint8Array,
): Promise<EncryptedVaultBlobBase64> {
  const { encryptedData, nonce } = await encryptJsonPayload(payload, dek);
  return {
    encrypted_data: toBase64(encryptedData),
    nonce: toBase64(nonce),
  };
}

export async function decryptJsonPayloadBase64<T>(
  encryptedDataBase64: string,
  nonceBase64: string,
  dek: Uint8Array,
): Promise<T> {
  return decryptJsonPayload<T>(fromBase64(encryptedDataBase64), fromBase64(nonceBase64), dek);
}
