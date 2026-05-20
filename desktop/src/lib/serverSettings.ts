import { load } from "@tauri-apps/plugin-store";
import { VaultlockApiClient } from "@vaultlock/shared/api";

export const DEFAULT_SERVER_BASE_URL = "http://localhost:8080";
export const SERVER_BASE_URL_KEY = "server_base_url";
const SETTINGS_STORE = "settings.json";

let storePromise: ReturnType<typeof load> | null = null;

async function getStore() {
  if (!storePromise) {
    storePromise = load(SETTINGS_STORE);
  }
  return storePromise;
}

export function normalizeServerBaseUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Server URL is required");
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  const parsed = new URL(candidate);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Server URL must use http or https");
  }

  return parsed.origin;
}

export async function loadServerBaseUrl(): Promise<string> {
  const store = await getStore();
  const value = await store.get<string>(SERVER_BASE_URL_KEY);
  return value ?? DEFAULT_SERVER_BASE_URL;
}

export async function saveServerBaseUrl(baseUrl: string): Promise<string> {
  const normalized = normalizeServerBaseUrl(baseUrl);
  const store = await getStore();
  await store.set(SERVER_BASE_URL_KEY, normalized);
  await store.save();
  return normalized;
}

export async function testServerConnection(baseUrl: string): Promise<boolean> {
  const normalized = normalizeServerBaseUrl(baseUrl);
  const client = new VaultlockApiClient({ baseUrl: normalized });
  return client.healthCheck();
}
