import { load } from "@tauri-apps/plugin-store";
import {
  deriveMasterKey,
  fromBase64,
  toBase64,
  unwrapDek,
  verifyMasterPasswordAuth,
  wrapDek,
} from "@vaultlock/shared/crypto";

const VAULT_KEYS_STORE = "vault-keys.json";
const WRAPPED_DEK_KEY = "wrapped_dek";

interface WrappedDekRecord {
  email: string;
  nonce: string;
  ciphertext: string;
}

let dataEncryptionKey: Uint8Array | null = null;

function zeroize(bytes: Uint8Array | null | undefined): void {
  if (bytes) {
    bytes.fill(0);
  }
}

function generateDek(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

async function getKeysStore() {
  return load(VAULT_KEYS_STORE);
}

async function loadWrappedDek(email: string): Promise<WrappedDekRecord | null> {
  const store = await getKeysStore();
  const record = await store.get<WrappedDekRecord>(WRAPPED_DEK_KEY);
  const normalizedEmail = email.trim().toLowerCase();
  if (!record || record.email !== normalizedEmail) {
    return null;
  }
  return record;
}

async function saveWrappedDek(
  email: string,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
): Promise<void> {
  const store = await getKeysStore();
  await store.set(WRAPPED_DEK_KEY, {
    email: email.trim().toLowerCase(),
    nonce: toBase64(nonce),
    ciphertext: toBase64(ciphertext),
  });
  await store.save();
}

export function isVaultUnlocked(): boolean {
  return dataEncryptionKey !== null;
}

export function getDataEncryptionKey(): Uint8Array {
  if (!dataEncryptionKey) {
    throw new Error("Vault is locked");
  }
  return dataEncryptionKey;
}

export async function unlockVault(params: {
  email: string;
  masterPassword: string;
  masterPasswordHash: string;
  wrappedDekFromServer?: { nonce?: string | Uint8Array; ciphertext?: string | Uint8Array };
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

    const existing = await loadWrappedDek(normalizedEmail);
    const fromServer = params.wrappedDekFromServer as
      | { nonce?: Uint8Array | string; ciphertext?: Uint8Array | string }
      | undefined;

    // Prefer server-provided wrapped_dek when we have no good local one (new device flow)
    const candidate =
      existing ??
      (fromServer
        ? {
            nonce: fromServer.nonce,
            ciphertext: fromServer.ciphertext,
          }
        : null);

    if (candidate) {
      try {
        const nonceBytes =
          typeof candidate.nonce === "string"
            ? fromBase64(candidate.nonce)
            : (candidate.nonce as Uint8Array);
        const ciphertextBytes =
          typeof candidate.ciphertext === "string"
            ? fromBase64(candidate.ciphertext)
            : (candidate.ciphertext as Uint8Array);

        dek = await unwrapDek(nonceBytes, ciphertextBytes, masterKey);

        // Persist the wrapped_dek locally if it came from the server
        if (!existing && fromServer) {
          const nonceToSave =
            typeof fromServer.nonce === "string"
              ? fromServer.nonce
              : toBase64(fromServer.nonce as Uint8Array);
          const ciphertextToSave =
            typeof fromServer.ciphertext === "string"
              ? fromServer.ciphertext
              : toBase64(fromServer.ciphertext as Uint8Array);
          await saveWrappedDek(normalizedEmail, nonceToSave, ciphertextToSave);
        }
      } catch {
        dek = null;
      }
    }

    let generatedNewDek = false;

    if (!dek) {
      // First device or recovery — generate fresh DEK (will be uploaded by caller)
      dek = generateDek();
      const { nonce, ciphertext } = await wrapDek(dek, masterKey);
      await saveWrappedDek(normalizedEmail, nonce, ciphertext);
      generatedNewDek = true;
    }

    lockVault();
    dataEncryptionKey = dek;

    return { generatedNewDek };
  } finally {
    zeroize(masterKey);
  }
}

export function lockVault(): void {
  zeroize(dataEncryptionKey);
  dataEncryptionKey = null;
}

export function restoreUnlockedDek(dek: Uint8Array): void {
  lockVault();
  dataEncryptionKey = dek;
}

/**
 * Returns the currently wrapped DEK record from local storage for the given email.
 * Useful for uploading to the server after first unlock on a device.
 */
export async function getCurrentWrappedDek(email: string) {
  const store = await getKeysStore();
  return store.get<WrappedDekRecord>(WRAPPED_DEK_KEY);
}

export async function clearWrappedDekStorage(): Promise<void> {
  lockVault();
  const store = await getKeysStore();
  await store.delete(WRAPPED_DEK_KEY);
  await store.save();
}
