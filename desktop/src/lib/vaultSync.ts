import { load } from "@tauri-apps/plugin-store";

const VAULT_SYNC_STORE = "vault-sync.json";
const SYNC_TOKENS_KEY = "sync_tokens";

type SyncTokenStore = Record<string, string>;

let storePromise: ReturnType<typeof load> | null = null;

async function getStore() {
  if (!storePromise) {
    storePromise = load(VAULT_SYNC_STORE);
  }
  return storePromise;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function maxSyncToken(
  current: string | null,
  candidates: Array<string | null | undefined>,
): string | null {
  let max = current;
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    if (!max || candidate > max) {
      max = candidate;
    }
  }
  return max;
}

export async function loadVaultSyncToken(email: string): Promise<string | null> {
  const store = await getStore();
  const tokens = (await store.get<SyncTokenStore>(SYNC_TOKENS_KEY)) ?? {};
  return tokens[normalizeEmail(email)] ?? null;
}

export async function saveVaultSyncToken(email: string, syncToken: string): Promise<void> {
  const store = await getStore();
  const tokens = (await store.get<SyncTokenStore>(SYNC_TOKENS_KEY)) ?? {};
  tokens[normalizeEmail(email)] = syncToken;
  await store.set(SYNC_TOKENS_KEY, tokens);
  await store.save();
}

export async function clearVaultSyncToken(email: string): Promise<void> {
  const store = await getStore();
  const tokens = (await store.get<SyncTokenStore>(SYNC_TOKENS_KEY)) ?? {};
  const key = normalizeEmail(email);
  if (!(key in tokens)) {
    return;
  }
  delete tokens[key];
  await store.set(SYNC_TOKENS_KEY, tokens);
  await store.save();
}

export async function clearAllVaultSyncTokens(): Promise<void> {
  const store = await getStore();
  await store.delete(SYNC_TOKENS_KEY);
  await store.save();
}
