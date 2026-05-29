/**
 * Typed storage helpers for the VaultLock extension.
 *
 * We wrap chrome.storage.local (via Plasmo's recommended approach) so the rest
 * of the extension can use clean, typed async functions.
 */

import { Storage } from "@plasmohq/storage";

const storage = new Storage();

/**
 * Server connection settings that the user configures in the extension.
 */
export interface ServerSettings {
  serverUrl: string;
  requestTimeoutMs: number;
  allowInsecureHttp: boolean;
}

const DEFAULT_SERVER_SETTINGS: ServerSettings = {
  serverUrl: "http://localhost:8080",
  requestTimeoutMs: 15000,
  allowInsecureHttp: false,
};

/**
 * Authentication session stored locally in the extension.
 * Tokens are stored here (encrypted at rest by the browser where possible).
 */
export interface AuthSession {
  email: string;
  accessToken: string;
  refreshToken: string;
}

/** Keys used in chrome.storage */
const KEYS = {
  SERVER_SETTINGS: "server_settings",
  AUTH_SESSION: "auth_session",
  VAULT_SYNC_TOKEN: "vault_sync_token",
} as const;

/** Server Settings */
export async function getServerSettings(): Promise<ServerSettings> {
  const data = await storage.get<ServerSettings>(KEYS.SERVER_SETTINGS);
  return { ...DEFAULT_SERVER_SETTINGS, ...data };
}

export async function saveServerSettings(settings: Partial<ServerSettings>): Promise<void> {
  const current = await getServerSettings();
  await storage.set(KEYS.SERVER_SETTINGS, { ...current, ...settings });
}

/** Auth Session */
export async function getAuthSession(): Promise<AuthSession | null> {
  return (await storage.get<AuthSession>(KEYS.AUTH_SESSION)) ?? null;
}

export async function saveAuthSession(session: AuthSession): Promise<void> {
  await storage.set(KEYS.AUTH_SESSION, session);
}

export async function clearAuthSession(): Promise<void> {
  await storage.remove(KEYS.AUTH_SESSION);
}

/** Sync token (used for efficient incremental vault sync) */
export async function getVaultSyncToken(): Promise<string | null> {
  return (await storage.get<string>(KEYS.VAULT_SYNC_TOKEN)) ?? null;
}

export async function saveVaultSyncToken(token: string): Promise<void> {
  await storage.set(KEYS.VAULT_SYNC_TOKEN, token);
}

export async function clearVaultSyncToken(): Promise<void> {
  await storage.remove(KEYS.VAULT_SYNC_TOKEN);
}

/** Last known connection test result */
export type LastConnectionStatus = {
  url: string;
  success: boolean;
  timestamp: number;
  error?: string;
};

export async function getLastConnectionStatus(): Promise<LastConnectionStatus | null> {
  return (await storage.get<LastConnectionStatus>("last_connection_status")) ?? null;
}

export async function saveLastConnectionStatus(status: LastConnectionStatus): Promise<void> {
  await storage.set("last_connection_status", status);
}

/** Wrapped DEK storage (encrypted with master key) */
export interface WrappedDekRecord {
  email: string;
  nonce: string;
  ciphertext: string;
}

const WRAPPED_DEK_KEY = "wrapped_dek";

export async function loadWrappedDek(email: string): Promise<WrappedDekRecord | null> {
  const record = await storage.get<WrappedDekRecord>(WRAPPED_DEK_KEY);
  const normalized = email.trim().toLowerCase();
  if (!record || record.email !== normalized) {
    return null;
  }
  return record;
}

export async function saveWrappedDek(
  email: string,
  nonce: string,
  ciphertext: string,
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  await storage.set(WRAPPED_DEK_KEY, {
    email: normalized,
    nonce,
    ciphertext,
  });
}

export async function clearWrappedDek(): Promise<void> {
  await storage.remove(WRAPPED_DEK_KEY);
}

/**
 * Encrypted vault cache persisted in chrome.storage.local.
 * This allows fast startup and incremental sync without holding decrypted data
 * in the background service worker (important for MV3 isolation + security).
 */
export interface EncryptedVaultCache {
  items: import("@vaultlock/shared/types").VaultItemResponse[];
  syncToken: string | null;
  updatedAt: number;
}

const ENCRYPTED_VAULT_CACHE_KEY = "encrypted_vault_cache";

export async function getEncryptedVaultCache(): Promise<EncryptedVaultCache | null> {
  return (await storage.get<EncryptedVaultCache>(ENCRYPTED_VAULT_CACHE_KEY)) ?? null;
}

export async function saveEncryptedVaultCache(cache: EncryptedVaultCache): Promise<void> {
  await storage.set(ENCRYPTED_VAULT_CACHE_KEY, cache);
}

export async function clearEncryptedVaultCache(): Promise<void> {
  await storage.remove(ENCRYPTED_VAULT_CACHE_KEY);
}
