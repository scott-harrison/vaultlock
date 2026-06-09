import type { Worker } from "@playwright/test";
import { E2E_TEST_DEK, buildE2eVaultCache } from "./testVault";

const DEFAULT_AUTH_SESSION = {
  email: "e2e@test.local",
  accessToken: "e2e-access-token",
  refreshToken: "e2e-refresh-token",
};

const DEFAULT_SERVER_SETTINGS = {
  serverUrl: "http://localhost:8080",
  requestTimeoutMs: 15000,
  allowInsecureHttp: true,
  configured: true,
};

export function getExtensionId(serviceWorker: Worker): string {
  return new URL(serviceWorker.url()).host;
}

export async function clearExtensionState(serviceWorker: Worker): Promise<void> {
  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.clear();
    await chrome.storage.session.clear();
  });
}

export async function seedAuthenticatedExtension(serviceWorker: Worker): Promise<void> {
  await serviceWorker.evaluate(
    async (data) => {
      await chrome.storage.local.set({
        auth_session: data.authSession,
        server_settings: data.serverSettings,
        encrypted_vault_cache: { items: [], syncToken: null, updatedAt: Date.now() },
      });
    },
    {
      authSession: DEFAULT_AUTH_SESSION,
      serverSettings: DEFAULT_SERVER_SETTINGS,
    },
  );
}

export async function seedUnlockedVaultExtension(serviceWorker: Worker): Promise<void> {
  const cache = await buildE2eVaultCache(E2E_TEST_DEK);
  const dekArray = Array.from(E2E_TEST_DEK);

  await serviceWorker.evaluate(
    async (data) => {
      await chrome.storage.local.set({
        auth_session: data.authSession,
        server_settings: data.serverSettings,
        encrypted_vault_cache: data.cache,
      });
      await chrome.storage.session.set({
        vaultSessionDek: data.dek,
        vaultSessionUnlocked: true,
      });

      await new Promise<void>((resolve) => {
        chrome.runtime.sendMessage({ type: "SYNC_VAULT_DEK", dek: data.dek }, () => {
          resolve();
        });
      });
    },
    {
      authSession: DEFAULT_AUTH_SESSION,
      serverSettings: DEFAULT_SERVER_SETTINGS,
      cache,
      dek: dekArray,
    },
  );
}

export async function seedPendingFillRequest(
  serviceWorker: Worker,
  tabId: number,
  hostname = "127.0.0.1",
): Promise<void> {
  await seedAuthenticatedExtension(serviceWorker);

  await serviceWorker.evaluate(
    async (data) => {
      await chrome.storage.session.set({
        pendingFillRequest: {
          hostname: data.hostname,
          fieldType: "password",
          tabId: data.tabId,
        },
      });
    },
    { hostname, tabId },
  );
}
