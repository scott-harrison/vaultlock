/**
 * Authentication helpers for the browser extension.
 *
 * Handles login against the backend and integrates with vault unlock.
 */

import { VaultlockApiClient } from "@vaultlock/shared/api";
import { createTimedFetch } from "./serverSettings";
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

  const unlockResult = await unlockVault({
    email: credentials.email,
    masterPassword: credentials.masterPassword,
    masterPasswordHash: response.master_password_hash,
    wrappedDekFromServer: response.wrapped_dek as Record<string, unknown> | undefined,
  });

  // Only upload if we generated a fresh DEK on this device (first device responsibility).
  if (unlockResult.generatedNewDek) {
    try {
      const { getCurrentWrappedDek } = await import("./vaultSession");
      const wrapped = await getCurrentWrappedDek(credentials.email);
      if (wrapped) {
        await client.saveWrappedDek(response.access_token, {
          nonce: wrapped.nonce,
          ciphertext: wrapped.ciphertext,
        });
      }
    } catch (e) {
      console.warn("[Auth] Failed to upload wrapped_dek (non-fatal)", e);
    }
  }
}

export async function logout(): Promise<void> {
  await clearAuthSession();
  await clearWrappedDek();
  lockVault();
}

// Re-exports for convenience
export { getAuthSession, saveAuthSession, clearAuthSession } from "./storage";
export { lockVault } from "./vaultSession";
