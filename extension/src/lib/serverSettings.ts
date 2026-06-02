/**
 * Server connection settings logic for the browser extension.
 * Reuses patterns from the desktop app and @vaultlock/shared.
 */

import { VaultlockApiClient } from "@vaultlock/shared/api";
import {
  type LastConnectionStatus,
  type ServerSettings,
  getLastConnectionStatus,
  getServerSettings,
  saveLastConnectionStatus,
  saveServerSettings,
} from "./storage";

export interface ServerAdvancedOptions {
  requestTimeoutMs: number;
  /**
   * DANGEROUS: Allows plaintext HTTP connections.
   * Only intended for local development against http://localhost.
   * Tracked as a security concern in #182.
   */
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
): Promise<{ success: boolean; error?: string }> {
  const normalized = normalizeServerBaseUrl(baseUrl);

  try {
    const client = new VaultlockApiClient({
      baseUrl: normalized,
      fetch: createTimedFetch(advanced.requestTimeoutMs),
    });
    const ok = await client.healthCheck();

    await saveLastConnectionStatus({
      url: normalized,
      success: ok,
      timestamp: Date.now(),
      error: ok ? undefined : "Health check did not return 'ok'",
    });

    return { success: ok, error: ok ? undefined : "Health check did not return 'ok'" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    await saveLastConnectionStatus({
      url: normalized,
      success: false,
      timestamp: Date.now(),
      error: message,
    });
    return { success: false, error: message };
  }
}

export async function saveServerConnection(
  baseUrl: string,
  advanced: ServerAdvancedOptions,
): Promise<string> {
  const normalized = normalizeServerBaseUrl(baseUrl);
  const result = await testServerConnection(normalized, advanced);

  if (!result.success) {
    throw new Error(result.error || "Could not connect to the server.");
  }

  if (advanced.allowInsecureHttp) {
    console.warn(
      "[VaultLock] SECURITY WARNING: allowInsecureHttp is enabled. " +
        "Master password and tokens will be sent over plaintext HTTP. " +
        "This setting is tracked in security sub-ticket #182.",
    );
  }

  await saveServerSettings({
    serverUrl: normalized,
    requestTimeoutMs: advanced.requestTimeoutMs,
    allowInsecureHttp: advanced.allowInsecureHttp,
    configured: true,
  });

  return normalized;
}

export async function loadServerSettingsWithAdvanced(): Promise<{
  url: string;
  advanced: ServerAdvancedOptions;
  lastStatus?: LastConnectionStatus;
}> {
  const settings = await getServerSettings();
  const lastStatus = await getLastConnectionStatus();

  return {
    url: settings.serverUrl,
    advanced: {
      requestTimeoutMs: settings.requestTimeoutMs,
      allowInsecureHttp: settings.allowInsecureHttp,
    },
    lastStatus: lastStatus ?? undefined,
  };
}
