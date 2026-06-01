import { getStorageLocal, getStorageSync } from "./browser";

/**
 * Typed storage helpers for the VaultLock extension.
 *
 * Uses chrome.storage.local directly (higher write quotas than sync).
 * This eliminates the MAX_WRITE_OPERATIONS_PER_MINUTE quota problems
 * caused by previous reliance on the low-quota sync storage area.
 *
 * A one-time best-effort migration from the old area runs on first access
 * and then permanently stops touching it.
 */

const MIGRATION_FLAG = "_storage_migrated_from_sync_v1";

let migrationPromise: Promise<void> | null = null;

async function migrateIfNeeded(): Promise<void> {
  if (migrationPromise) return migrationPromise;

  migrationPromise = (async () => {
    try {
      const flag = await getStorageLocal().get(MIGRATION_FLAG);
      if (flag[MIGRATION_FLAG]) return;

      // Read whatever the previous implementation (which hit .sync and caused quota errors)
      // may have persisted. We do this with native APIs only — no dependency on the old
      // package that was never properly declared in package.json.
      const sync = getStorageSync();
      const syncData = sync ? await sync.get(null) : null;

      if (syncData && typeof syncData === "object") {
        const toMigrate: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(syncData)) {
          if (key !== MIGRATION_FLAG) {
            toMigrate[key] = value;
          }
        }

        if (Object.keys(toMigrate).length > 0) {
          await getStorageLocal().set(toMigrate);

          // Best-effort cleanup of the source so we stop burning the very low sync quota.
          if (sync) {
            await sync.remove(Object.keys(toMigrate)).catch(() => {});
          }
        }
      }

      await getStorageLocal().set({ [MIGRATION_FLAG]: true });
    } catch (err) {
      console.warn("[VaultLock Storage] Migration encountered a non-fatal error:", err);
      await getStorageLocal()
        .set({ [MIGRATION_FLAG]: true })
        .catch(() => {});
    }
  })();

  return migrationPromise;
}

async function ensureReady(): Promise<void> {
  await migrateIfNeeded();
}

async function get<T>(key: string): Promise<T | undefined> {
  await ensureReady();
  const result = await getStorageLocal().get(key);
  return result[key] as T | undefined;
}

async function set(values: Record<string, unknown>): Promise<void> {
  await ensureReady();
  await getStorageLocal().set(values);
}

async function remove(keys: string | string[]): Promise<void> {
  await ensureReady();
  await getStorageLocal().remove(keys);
}

/**
 * Server connection settings that the user configures in the extension.
 */
export interface ServerSettings {
  serverUrl: string;
  requestTimeoutMs: number;
  allowInsecureHttp: boolean;
  /** Set when the user saves a successful connection test in extension settings. */
  configured: boolean;
}

const DEFAULT_SERVER_SETTINGS: ServerSettings = {
  serverUrl: "http://localhost:8080",
  requestTimeoutMs: 15000,
  allowInsecureHttp: false,
  configured: false,
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
  const data = await get<ServerSettings>(KEYS.SERVER_SETTINGS);
  const merged = { ...DEFAULT_SERVER_SETTINGS, ...data };
  // Settings persisted before `configured` existed were saved via options.
  if (data !== undefined && data.configured === undefined) {
    merged.configured = Boolean(data.serverUrl?.trim());
  }
  return merged;
}

export function isServerConfigured(settings: ServerSettings): boolean {
  return settings.configured && settings.serverUrl.trim().length > 0;
}

export async function saveServerSettings(settings: Partial<ServerSettings>): Promise<void> {
  const current = await getServerSettings();
  await set({ [KEYS.SERVER_SETTINGS]: { ...current, ...settings } });
}

/** Auth Session */
export async function getAuthSession(): Promise<AuthSession | null> {
  return (await get<AuthSession>(KEYS.AUTH_SESSION)) ?? null;
}

export async function saveAuthSession(session: AuthSession): Promise<void> {
  await set({ [KEYS.AUTH_SESSION]: session });
}

export async function clearAuthSession(): Promise<void> {
  await remove(KEYS.AUTH_SESSION);
}

/** Sync token (used for efficient incremental vault sync) */
export async function getVaultSyncToken(): Promise<string | null> {
  return (await get<string>(KEYS.VAULT_SYNC_TOKEN)) ?? null;
}

export async function saveVaultSyncToken(token: string): Promise<void> {
  await set({ [KEYS.VAULT_SYNC_TOKEN]: token });
}

export async function clearVaultSyncToken(): Promise<void> {
  await remove(KEYS.VAULT_SYNC_TOKEN);
}

/** Last known connection test result */
export type LastConnectionStatus = {
  url: string;
  success: boolean;
  timestamp: number;
  error?: string;
};

export async function getLastConnectionStatus(): Promise<LastConnectionStatus | null> {
  return (await get<LastConnectionStatus>("last_connection_status")) ?? null;
}

export async function saveLastConnectionStatus(status: LastConnectionStatus): Promise<void> {
  await set({ last_connection_status: status });
}

/** Wrapped DEK storage (encrypted with master key) */
export interface WrappedDekRecord {
  email: string;
  nonce: string;
  ciphertext: string;
}

const WRAPPED_DEK_KEY = "wrapped_dek";

export async function loadWrappedDek(email: string): Promise<WrappedDekRecord | null> {
  const record = await get<WrappedDekRecord>(WRAPPED_DEK_KEY);
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
  await set({
    [WRAPPED_DEK_KEY]: {
      email: normalized,
      nonce,
      ciphertext,
    },
  });
}

export async function clearWrappedDek(): Promise<void> {
  await remove(WRAPPED_DEK_KEY);
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
  return (await get<EncryptedVaultCache>(ENCRYPTED_VAULT_CACHE_KEY)) ?? null;
}

export async function saveEncryptedVaultCache(cache: EncryptedVaultCache): Promise<void> {
  await set({ [ENCRYPTED_VAULT_CACHE_KEY]: cache });
}

export async function clearEncryptedVaultCache(): Promise<void> {
  await remove(ENCRYPTED_VAULT_CACHE_KEY);
}
