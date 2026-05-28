/**
 * Server connection settings logic for the browser extension.
 * Reuses patterns from the desktop app and @vaultlock/shared.
 */

import { VaultlockApiClient } from "@vaultlock/shared/api";
import { type ServerSettings, getServerSettings, saveServerSettings } from "./storage";

export interface ServerAdvancedOptions {
  requestTimeoutMs: number;
  allowInsecureHttp: boolean;
}

export const DEFAULT_SERVER_ADVANCED: ServerAdvancedOptions = {
  requestTimeoutMs: 15000,
  allowInsecureHttp: false,
};

export function normalizeServerBaseUrl(url: string): string {
  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }
  return normalized.replace(/\/$/, "");
}

export function createTimedFetch(timeoutMs: number): typeof fetch {
  return (input, init) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const signals = [controller.signal];
    if (init?.signal) signals.push(init.signal);

    const combinedSignal =
      signals.length > 1 && "any" in AbortSignal ? AbortSignal.any(signals) : controller.signal;

    return globalThis
      .fetch(input, { ...init, signal: combinedSignal })
      .finally(() => clearTimeout(timeoutId));
  };
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

export async function saveServerConnection(
  baseUrl: string,
  advanced: ServerAdvancedOptions,
): Promise<string> {
  const normalized = normalizeServerBaseUrl(baseUrl);
  const ok = await testServerConnection(normalized, advanced);
  if (!ok) {
    throw new Error("Could not connect to the server. Check the URL and try again.");
  }

  await saveServerSettings({
    serverUrl: normalized,
    requestTimeoutMs: advanced.requestTimeoutMs,
    allowInsecureHttp: advanced.allowInsecureHttp,
  });

  return normalized;
}

export async function loadServerSettingsWithAdvanced(): Promise<{
  url: string;
  advanced: ServerAdvancedOptions;
}> {
  const settings = await getServerSettings();
  return {
    url: settings.serverUrl,
    advanced: {
      requestTimeoutMs: settings.requestTimeoutMs,
      allowInsecureHttp: settings.allowInsecureHttp,
    },
  };
}
