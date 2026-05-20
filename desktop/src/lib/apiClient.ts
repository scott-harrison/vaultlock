import { VaultlockApiClient } from "@vaultlock/shared/api";
import { loadServerBaseUrl } from "./serverSettings";

export async function createApiClient(): Promise<VaultlockApiClient> {
  const baseUrl = await loadServerBaseUrl();
  return new VaultlockApiClient({ baseUrl });
}
