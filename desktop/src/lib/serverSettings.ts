import { load } from "@tauri-apps/plugin-store";
import { VaultlockApiClient } from "@vaultlock/shared/api";

export const SERVER_BASE_URL_KEY = "server_base_url";
export const SERVER_ADVANCED_KEY = "server_advanced";

const SETTINGS_STORE = "settings.json";
const DEFAULT_TIMEOUT_MS = 15_000;

export interface ServerAdvancedOptions {
  requestTimeoutMs: number;
  allowInsecureHttp: boolean;
  trustSelfSignedCert: boolean;
}

export const DEFAULT_SERVER_ADVANCED: ServerAdvancedOptions = {
  requestTimeoutMs: DEFAULT_TIMEOUT_MS,
  allowInsecureHttp: false,
  trustSelfSignedCert: false,
};

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

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : /^(localhost|127\.|\[::1\])/i.test(trimmed)
      ? `http://${trimmed}`
      : `https://${trimmed}`;
  const parsed = new URL(candidate);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Server URL must use http or https");
  }

  return parsed.origin;
}

export function isLocalhostUrl(baseUrl: string): boolean {
  try {
    const { hostname } = new URL(baseUrl);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

export function shouldWarnInsecureHttp(baseUrl: string, advanced: ServerAdvancedOptions): boolean {
  if (advanced.allowInsecureHttp) {
    return false;
  }
  try {
    return new URL(baseUrl).protocol === "http:" && !isLocalhostUrl(baseUrl);
  } catch {
    return false;
  }
}

export async function loadServerBaseUrl(): Promise<string | null> {
  const store = await getStore();
  const value = await store.get<string>(SERVER_BASE_URL_KEY);
  return value ?? null;
}

export async function loadServerAdvancedOptions(): Promise<ServerAdvancedOptions> {
  const store = await getStore();
  const value = await store.get<ServerAdvancedOptions>(SERVER_ADVANCED_KEY);
  return value ?? DEFAULT_SERVER_ADVANCED;
}

export async function saveServerAdvancedOptions(
  options: ServerAdvancedOptions,
): Promise<ServerAdvancedOptions> {
  const store = await getStore();
  const normalized: ServerAdvancedOptions = {
    requestTimeoutMs: Math.max(3_000, Math.min(options.requestTimeoutMs, 120_000)),
    allowInsecureHttp: options.allowInsecureHttp,
    trustSelfSignedCert: options.trustSelfSignedCert,
  };
  await store.set(SERVER_ADVANCED_KEY, normalized);
  await store.save();
  return normalized;
}

export async function saveServerBaseUrl(baseUrl: string): Promise<string> {
  const normalized = normalizeServerBaseUrl(baseUrl);
  const store = await getStore();
  await store.set(SERVER_BASE_URL_KEY, normalized);
  await store.save();
  return normalized;
}

export async function testServerConnection(
  baseUrl: string,
  advanced: ServerAdvancedOptions = DEFAULT_SERVER_ADVANCED,
): Promise<boolean> {
  const normalized = normalizeServerBaseUrl(baseUrl);
  const client = new VaultlockApiClient({
    baseUrl: normalized,
    fetch: createTimedFetch(advanced.requestTimeoutMs),
  });
  return client.healthCheck();
}

export async function connectServer(
  baseUrl: string,
  advanced: ServerAdvancedOptions = DEFAULT_SERVER_ADVANCED,
): Promise<string> {
  const normalized = normalizeServerBaseUrl(baseUrl);
  const ok = await testServerConnection(normalized, advanced);
  if (!ok) {
    throw new Error("Could not connect to the server. Check the URL and try again.");
  }
  await saveServerBaseUrl(normalized);
  return normalized;
}

export function createTimedFetch(timeoutMs: number): typeof fetch {
  return (input, init) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const signals = [controller.signal];
    if (init?.signal) {
      signals.push(init.signal);
    }

    const combinedSignal =
      signals.length > 1 && "any" in AbortSignal ? AbortSignal.any(signals) : controller.signal;

    return globalThis
      .fetch(input, { ...init, signal: combinedSignal })
      .finally(() => clearTimeout(timeoutId));
  };
}
