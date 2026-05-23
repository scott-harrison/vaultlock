import { load } from "@tauri-apps/plugin-store";
import { type BiometricUnlockStatus, getBiometricUnlockStatus } from "./biometricUnlock";

const SETTINGS_STORE = "settings.json";

export const AUTO_LOCK_MINUTES_KEY = "security.auto_lock_minutes";
export const MASTER_PASSWORD_REAUTH_DAYS_KEY = "security.master_password_reauth_days";

export const DEFAULT_AUTO_LOCK_MINUTES = 5;
export const DEFAULT_MASTER_PASSWORD_REAUTH_DAYS = 7;

export const AUTO_LOCK_OPTIONS = [
  { value: 1, label: "1 minute" },
  { value: 5, label: "5 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 0, label: "Never" },
] as const;

export const MASTER_PASSWORD_REAUTH_OPTIONS = [
  { value: 1, label: "Every day" },
  { value: 7, label: "Every 7 days" },
  { value: 30, label: "Every 30 days" },
  { value: 0, label: "Never" },
] as const;

export interface BiometricQuickUnlockAvailability {
  status: BiometricUnlockStatus;
  masterPasswordReauthRequired: boolean;
  showBiometricUnlock: boolean;
}

let storePromise: ReturnType<typeof load> | null = null;

async function getStore() {
  if (!storePromise) {
    storePromise = load(SETTINGS_STORE);
  }
  return storePromise;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function lastMasterPasswordUnlockKey(email: string): string {
  return `security.last_master_password_unlock:${normalizeEmail(email)}`;
}

function daysToMs(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}

export async function loadAutoLockMinutes(): Promise<number> {
  const store = await getStore();
  const value = await store.get<number>(AUTO_LOCK_MINUTES_KEY);
  if (value === undefined || value === null) {
    return DEFAULT_AUTO_LOCK_MINUTES;
  }
  return value;
}

/** Returns null when auto-lock is disabled ("Never"). */
export async function loadAutoLockTimeoutMs(): Promise<number | null> {
  const minutes = await loadAutoLockMinutes();
  if (minutes === 0) {
    return null;
  }
  return minutes * 60 * 1000;
}

export async function saveAutoLockMinutes(minutes: number): Promise<number> {
  const store = await getStore();
  const allowed = AUTO_LOCK_OPTIONS.map((option) => option.value);
  const normalized = allowed.includes(minutes as (typeof allowed)[number])
    ? minutes
    : DEFAULT_AUTO_LOCK_MINUTES;
  await store.set(AUTO_LOCK_MINUTES_KEY, normalized);
  await store.save();
  return normalized;
}

export async function loadMasterPasswordReauthDays(): Promise<number> {
  const store = await getStore();
  const value = await store.get<number>(MASTER_PASSWORD_REAUTH_DAYS_KEY);
  if (value === undefined || value === null) {
    return DEFAULT_MASTER_PASSWORD_REAUTH_DAYS;
  }
  return value;
}

export async function saveMasterPasswordReauthDays(days: number): Promise<number> {
  const store = await getStore();
  const allowed = MASTER_PASSWORD_REAUTH_OPTIONS.map((option) => option.value);
  const normalized = allowed.includes(days as (typeof allowed)[number])
    ? days
    : DEFAULT_MASTER_PASSWORD_REAUTH_DAYS;
  await store.set(MASTER_PASSWORD_REAUTH_DAYS_KEY, normalized);
  await store.save();
  return normalized;
}

export async function recordMasterPasswordUnlock(email: string): Promise<void> {
  const store = await getStore();
  await store.set(lastMasterPasswordUnlockKey(email), Date.now());
  await store.save();
}

async function loadLastMasterPasswordUnlockAt(email: string): Promise<number | null> {
  const store = await getStore();
  const value = await store.get<number>(lastMasterPasswordUnlockKey(email));
  return typeof value === "number" ? value : null;
}

export async function isMasterPasswordReauthRequired(email: string): Promise<boolean> {
  const days = await loadMasterPasswordReauthDays();
  if (days === 0) {
    return false;
  }

  const lastUnlockAt = await loadLastMasterPasswordUnlockAt(email);
  if (lastUnlockAt === null) {
    return true;
  }

  return Date.now() - lastUnlockAt >= daysToMs(days);
}

export async function getBiometricQuickUnlockAvailability(
  email: string,
): Promise<BiometricQuickUnlockAvailability> {
  const status = await getBiometricUnlockStatus(email);
  const masterPasswordReauthRequired =
    status.enabled && (await isMasterPasswordReauthRequired(email));

  return {
    status,
    masterPasswordReauthRequired,
    showBiometricUnlock: status.available && status.enabled && !masterPasswordReauthRequired,
  };
}
