/**
 * Typed storage helpers for the VaultLock extension.
 *
 * Uses chrome.storage.local directly (higher write quotas than sync).
 * This eliminates the MAX_WRITE_OPERATIONS_PER_MINUTE quota problems
 * that occurred when the extension previously used @plasmohq/storage
 * (which defaults to sync storage).
 *
 * A robust one-time migration from the old storage area is performed
 * on first access.
 */

const MIGRATION_FLAG = "_storage_migrated_from_sync_v1";

let migrationPromise: Promise<void> | null = null;

/** One-time migration from previous storage (likely sync via @plasmohq/storage) */
async function migrateIfNeeded(): Promise<void> {
  if (migrationPromise) return migrationPromise;

  migrationPromise = (async () => {
    try {
      const flag = await chrome.storage.local.get(MIGRATION_FLAG);
      if (flag[MIGRATION_FLAG]) return;

      // Attempt to read from the old @plasmohq/storage instance if it still exists
      let legacyData: Record<string, unknown> = {};
      try {
        const { Storage } = await import("@plasmohq/storage");
        const oldStorage = new Storage();
        const all = await oldStorage.get<Record<string, unknown>>(null);
        if (all && typeof all === "object") {
          legacyData = all as Record<string, unknown>;
        }
      } catch {
        // @plasmohq/storage may not be installed or may have no data — that's fine
      }

      if (Object.keys(legacyData).length > 0) {
        await chrome.storage.local.set(legacyData);
        // Best effort cleanup of old data
        try {
          const { Storage } = await import("@plasmohq/storage");
          const oldStorage = new Storage();
          await oldStorage.clear?.();
        } catch {}
      }

      await chrome.storage.local.set({ [MIGRATION_FLAG]: true });
    } catch (err) {
      console.warn("[VaultLock Storage] Migration encountered a non-fatal error:", err);
      // Still mark as migrated so we don't keep retrying
      await chrome.storage.local.set({ [MIGRATION_FLAG]: true }).catch(() => {});
    }
  })();

  return migrationPromise;
}

async function ensureReady(): Promise<void> {
  await migrateIfNeeded();
}

async function get<T>(key: string): Promise<T | undefined> {
  await ensureReady();
  const result = await chrome.storage.local.get(key);
  return result[key] as T | undefined;
}

async function set(values: Record<string, unknown>): Promise<void> {
  await ensureReady();
  await chrome.storage.local.set(values);
}

async function remove(keys: string | string[]): Promise<void> {
  await ensureReady();
  await chrome.storage.local.remove(keys);
}

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
  const data = await get<ServerSettings>(KEYS.SERVER_SETTINGS);
  return { ...DEFAULT_SERVER_SETTINGS, ...data };
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
