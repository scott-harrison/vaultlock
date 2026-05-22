import {
  BiometryType,
  authenticate,
  checkStatus,
  getData,
  hasData,
  removeData,
  setData,
} from "@choochmeque/tauri-plugin-biometry-api";
import { load } from "@tauri-apps/plugin-store";
import { fromBase64, toBase64 } from "@vaultlock/shared/crypto";

const BIOMETRY_DOMAIN = "com.vaultlock.desktop";
const BIOMETRIC_KEY_PREFIX = "quick-unlock-key";
const DEV_FALLBACK_STORE = "biometric-dev-fallback.json";

export interface BiometricUnlockStatus {
  available: boolean;
  enabled: boolean;
  label: string;
  usesDevFallback: boolean;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function storageName(email: string): string {
  return `${BIOMETRIC_KEY_PREFIX}:${normalizeEmail(email)}`;
}

function biometryLabel(type: BiometryType): string {
  switch (type) {
    case BiometryType.TouchID:
      return "Touch ID";
    case BiometryType.FaceID:
      return "Face ID";
    case BiometryType.Auto:
      return "Windows Hello";
    default:
      return "Biometrics";
  }
}

function isDevBuild(): boolean {
  return import.meta.env.DEV;
}

function isKeychainError(error: unknown): boolean {
  const message = readErrorText(error).toLowerCase();
  return (
    message.includes("keychain") ||
    message.includes("-34018") ||
    message.includes("missingentitlement") ||
    message.includes("keychainerror")
  );
}

async function getDevFallbackStore() {
  return load(DEV_FALLBACK_STORE);
}

async function hasDevFallbackKey(email: string): Promise<boolean> {
  if (!isDevBuild()) {
    return false;
  }

  const store = await getDevFallbackStore();
  const value = await store.get<string>(storageName(email));
  return typeof value === "string" && value.length > 0;
}

async function storeDevFallbackKey(email: string, key: Uint8Array): Promise<void> {
  const store = await getDevFallbackStore();
  await store.set(storageName(email), toBase64(key));
  await store.save();
}

async function loadDevFallbackKey(email: string): Promise<Uint8Array> {
  const store = await getDevFallbackStore();
  const value = await store.get<string>(storageName(email));
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Biometric quick unlock is not set up on this device.");
  }

  const key = fromBase64(value);
  if (key.length !== 32) {
    throw new Error("Stored biometric unlock key is invalid.");
  }
  return key;
}

async function clearDevFallbackKey(email: string): Promise<void> {
  if (!isDevBuild()) {
    return;
  }

  const store = await getDevFallbackStore();
  const name = storageName(email);
  if (await store.get(name)) {
    await store.delete(name);
    await store.save();
  }
}

export async function getBiometricUnlockStatus(email: string): Promise<BiometricUnlockStatus> {
  const status = await checkStatus();
  const available = status.isAvailable;
  const keychainEnabled = available
    ? await hasData({ domain: BIOMETRY_DOMAIN, name: storageName(email) })
    : false;
  const devFallbackEnabled = available ? await hasDevFallbackKey(email) : false;

  return {
    available,
    enabled: keychainEnabled || devFallbackEnabled,
    label: biometryLabel(status.biometryType),
    usesDevFallback: devFallbackEnabled && !keychainEnabled,
  };
}

export async function storeBiometricUnlockKey(email: string, key: Uint8Array): Promise<void> {
  if (key.length !== 32) {
    throw new Error("Biometric unlock key must be 32 bytes.");
  }

  try {
    await setData({
      domain: BIOMETRY_DOMAIN,
      name: storageName(email),
      data: toBase64(key),
    });
    await clearDevFallbackKey(email);
  } catch (error) {
    if (isDevBuild() && isKeychainError(error)) {
      await storeDevFallbackKey(email, key);
      return;
    }
    throw error;
  }
}

export async function loadBiometricUnlockKey(email: string, reason: string): Promise<Uint8Array> {
  if (await hasDevFallbackKey(email)) {
    await authenticate(reason, { allowDeviceCredential: true });
    return loadDevFallbackKey(email);
  }

  const response = await getData({
    domain: BIOMETRY_DOMAIN,
    name: storageName(email),
    reason,
  });
  const key = fromBase64(response.data);
  if (key.length !== 32) {
    throw new Error("Stored biometric unlock key is invalid.");
  }
  return key;
}

export async function clearBiometricUnlockKey(email: string): Promise<void> {
  const name = storageName(email);
  const exists = await hasData({ domain: BIOMETRY_DOMAIN, name });
  if (exists) {
    await removeData({ domain: BIOMETRY_DOMAIN, name });
  }
  await clearDevFallbackKey(email);
}

function readErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "";
}

export function formatBiometryError(error: unknown, label: string): string {
  const message = readErrorText(error).toLowerCase();

  if (
    message.includes("usercancel") ||
    message.includes("user cancel") ||
    message.includes("canceled")
  ) {
    return `${label} setup was cancelled.`;
  }
  if (message.includes("biometrylockout") || message.includes("too many failed")) {
    return `${label} is temporarily locked. Try again later or use your master password.`;
  }
  if (readErrorText(error)) {
    return readErrorText(error);
  }
  return `Couldn't update ${label} settings. Try again.`;
}

export async function confirmBiometricEnrollment(label: string): Promise<void> {
  await authenticate(`Enable ${label} quick unlock for Vaultlock`, {
    allowDeviceCredential: true,
  });
}
