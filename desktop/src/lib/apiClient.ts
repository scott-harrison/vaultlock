import { VaultlockApiClient } from "@vaultlock/shared/api";
import {
  createAuthTimedFetch,
  createTimedFetch,
  loadServerAdvancedOptions,
  loadServerBaseUrl,
} from "./serverSettings";

export async function createApiClient(): Promise<VaultlockApiClient> {
  const baseUrl = await loadServerBaseUrl();
  if (!baseUrl) {
    throw new Error("Server URL is not configured");
  }

  const advanced = await loadServerAdvancedOptions();
  return new VaultlockApiClient({
    baseUrl,
    fetch: createTimedFetch(advanced.requestTimeoutMs),
  });
}

export async function createAuthApiClient(): Promise<VaultlockApiClient> {
  const baseUrl = await loadServerBaseUrl();
  if (!baseUrl) {
    throw new Error("Server URL is not configured");
  }

  const advanced = await loadServerAdvancedOptions();
  return new VaultlockApiClient({
    baseUrl,
    fetch: createAuthTimedFetch(advanced),
  });
}
