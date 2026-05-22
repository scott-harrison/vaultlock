import { load } from "@tauri-apps/plugin-store";
import { decrypt, encrypt, fromBase64, toBase64 } from "@vaultlock/shared/crypto";
import {
  clearBiometricUnlockKey,
  confirmBiometricEnrollment,
  getBiometricUnlockStatus,
  loadBiometricUnlockKey,
  storeBiometricUnlockKey,
} from "./biometricUnlock";
import { getDataEncryptionKey, isVaultUnlocked, restoreUnlockedDek } from "./vaultSession";

const VAULT_KEYS_STORE = "vault-keys.json";
const BIOMETRIC_ENVELOPE_KEY = "biometric_dek_envelope";

interface QuickUnlockEnvelope {
  version: 1;
  email: string;
  nonce: string;
  ciphertext: string;
}

function zeroize(bytes: Uint8Array | null | undefined): void {
  if (bytes) {
    bytes.fill(0);
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function getKeysStore() {
  return load(VAULT_KEYS_STORE);
}

async function loadQuickUnlockEnvelope(email: string): Promise<QuickUnlockEnvelope | null> {
  const store = await getKeysStore();
  const record = await store.get<QuickUnlockEnvelope>(BIOMETRIC_ENVELOPE_KEY);
  const normalizedEmail = normalizeEmail(email);
  if (!record || record.email !== normalizedEmail || record.version !== 1) {
    return null;
  }
  return record;
}

async function saveQuickUnlockEnvelope(
  email: string,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
): Promise<void> {
  const store = await getKeysStore();
  await store.set(BIOMETRIC_ENVELOPE_KEY, {
    version: 1,
    email: normalizeEmail(email),
    nonce: toBase64(nonce),
    ciphertext: toBase64(ciphertext),
  });
  await store.save();
}

async function clearQuickUnlockEnvelope(): Promise<void> {
  const store = await getKeysStore();
  await store.delete(BIOMETRIC_ENVELOPE_KEY);
  await store.save();
}

export async function enableBiometricQuickUnlock(email: string): Promise<void> {
  if (!isVaultUnlocked()) {
    throw new Error("Unlock the vault with your master password before enabling biometrics.");
  }

  const status = await getBiometricUnlockStatus(email);
  if (!status.available) {
    throw new Error("Biometric quick unlock is not available on this device.");
  }

  await confirmBiometricEnrollment(status.label);

  const dek = new Uint8Array(getDataEncryptionKey());
  const biometricUnlockKey = crypto.getRandomValues(new Uint8Array(32));

  try {
    const { nonce, ciphertext } = await encrypt(dek, biometricUnlockKey);
    await storeBiometricUnlockKey(email, biometricUnlockKey);
    try {
      await saveQuickUnlockEnvelope(email, nonce, ciphertext);
    } catch (envelopeError) {
      await clearBiometricUnlockKey(email).catch(() => undefined);
      throw envelopeError;
    }
  } finally {
    zeroize(dek);
    zeroize(biometricUnlockKey);
  }
}

export async function unlockVaultWithBiometric(
  email: string,
  biometricLabel: string,
): Promise<void> {
  const envelope = await loadQuickUnlockEnvelope(email);
  if (!envelope) {
    throw new Error("Biometric quick unlock is not set up on this device.");
  }

  const biometricUnlockKey = await loadBiometricUnlockKey(
    email,
    `Unlock Vaultlock with ${biometricLabel}`,
  );

  try {
    const dek = await decrypt(
      fromBase64(envelope.nonce),
      fromBase64(envelope.ciphertext),
      biometricUnlockKey,
    );
    restoreUnlockedDek(dek);
  } finally {
    zeroize(biometricUnlockKey);
  }
}

export async function disableBiometricQuickUnlock(email: string): Promise<void> {
  await clearBiometricUnlockKey(email);
  await clearQuickUnlockEnvelope();
}
