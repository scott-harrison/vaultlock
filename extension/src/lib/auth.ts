/**
 * Authentication helpers for the browser extension.
 *
 * Handles login against the backend and integrates with vault unlock.
 */

import { VaultlockApiClient } from "@vaultlock/shared/api";
import { createTimedFetch } from "./serverSettings"; // reuse from 12-02
import { getServerSettings } from "./storage";
import { unlockVault } from "./vaultSession";

export interface LoginCredentials {
  email: string;
  masterPassword: string;
}

export async function loginAndUnlock(credentials: LoginCredentials): Promise<void> {
  const serverSettings = await getServerSettings();

  const client = new VaultlockApiClient({
    baseUrl: serverSettings.serverUrl,
    fetch: createTimedFetch(serverSettings.requestTimeoutMs),
  });

  const response = await client.login({
    email: credentials.email,
    master_password: credentials.masterPassword,
  });

  if (!response.master_password_hash) {
    throw new Error("Server did not return master password hash. Login failed.");
  }

  // Save auth session
  await saveAuthSession({
    email: credentials.email,
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
  });

  // Unlock the vault using the master password + hash from server
  await unlockVault({
    email: credentials.email,
    masterPassword: credentials.masterPassword,
    masterPasswordHash: response.master_password_hash,
  });
}

export async function logout(): Promise<void> {
  // Clear auth + lock vault
  await clearAuthSession();
  await clearWrappedDek(); // from storage
  lockVault();
}

// Re-exports for convenience
export { getAuthSession, saveAuthSession, clearAuthSession } from "./storage";
export { lockVault } from "./vaultSession";
