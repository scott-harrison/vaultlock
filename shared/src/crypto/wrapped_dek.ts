/**
 * Normalizes wrapped_dek JSON from login responses or storage.
 * Accepts flat `{ nonce, ciphertext }` or nested `{ wrapped_dek: { ... } }`.
 */
export interface WrappedDekBlob {
  nonce: string;
  ciphertext: string;
}

export function parseWrappedDekJson(value: unknown): WrappedDekBlob | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const inner =
    record.wrapped_dek && typeof record.wrapped_dek === "object"
      ? (record.wrapped_dek as Record<string, unknown>)
      : record;

  const nonce = inner.nonce;
  const ciphertext = inner.ciphertext;

  if (typeof nonce === "string" && typeof ciphertext === "string" && nonce.length > 0) {
    return { nonce, ciphertext };
  }

  return null;
}
