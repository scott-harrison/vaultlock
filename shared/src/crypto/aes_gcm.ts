/**
 * AES-256-GCM via Web Crypto API (browser, Tauri webview, extension).
 */

export interface EncryptedData {
  nonce: Uint8Array;
  ciphertext: Uint8Array;
}

export async function encrypt(plaintext: Uint8Array, key: Uint8Array): Promise<EncryptedData> {
  if (key.length !== 32) {
    throw new Error("Key must be 32 bytes for AES-256");
  }

  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "AES-GCM" }, false, [
    "encrypt",
  ]);

  const nonce = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    cryptoKey,
    plaintext,
  );

  return {
    nonce,
    ciphertext: new Uint8Array(ciphertext),
  };
}

export async function decrypt(
  nonce: Uint8Array,
  ciphertext: Uint8Array,
  key: Uint8Array,
): Promise<Uint8Array> {
  if (key.length !== 32) {
    throw new Error("Key must be 32 bytes for AES-256");
  }

  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "AES-GCM" }, false, [
    "decrypt",
  ]);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce },
    cryptoKey,
    ciphertext,
  );

  return new Uint8Array(plaintext);
}

export async function wrapDek(dek: Uint8Array, masterKey: Uint8Array): Promise<EncryptedData> {
  return encrypt(dek, masterKey);
}

export async function unwrapDek(
  nonce: Uint8Array,
  wrappedDek: Uint8Array,
  masterKey: Uint8Array,
): Promise<Uint8Array> {
  return decrypt(nonce, wrappedDek, masterKey);
}

export function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function fromBase64(base64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
