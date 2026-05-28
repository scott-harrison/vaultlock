/**
 * Typed storage helpers for the VaultLock extension.
 *
 * We wrap chrome.storage.local (via Plasmo's recommended approach) so the rest
 * of the extension can use clean, typed async functions.
 *
 * This will be heavily used starting in 12-02 (Server connection) and 12-04 (Auth).
 *
 * For now (end of 12-01) this is the foundation. Feel free to evolve it.
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
