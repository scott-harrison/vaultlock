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
        // Stale local keys (e.g. re-registration or corrupted store). Password was verified above.
        dek = generateDek();
        const { nonce, ciphertext } = await wrapDek(dek, masterKey);
        await saveWrappedDek(normalizedEmail, nonce, ciphertext);
      }
    } else {
      dek = generateDek();
      const { nonce, ciphertext } = await wrapDek(dek, masterKey);
      await saveWrappedDek(normalizedEmail, nonce, ciphertext);
    }

    lockVault();
    dataEncryptionKey = dek;
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

export async function clearWrappedDekStorage(): Promise<void> {
  lockVault();
  const store = await getKeysStore();
  await store.delete(WRAPPED_DEK_KEY);
  await store.save();
}
