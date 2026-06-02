/**
 * Background service worker for the VaultLock extension.
 *
 * Responsibilities:
 * - Message passing between content scripts and popup for autofill ("fill on click")
 * - Storing pending fill requests (hostname + field context)
 * - Later: background sync, token refresh, etc.
 */

import { VaultlockApiClient } from "@vaultlock/shared/api";
import type { VaultItemResponse } from "@vaultlock/shared/types";
import { getAuthSession } from "./lib/auth";
import type { AutofillRequest } from "./lib/messaging";
import { createTimedFetch } from "./lib/serverSettings";
import {
  clearEncryptedVaultCache,
  clearVaultSyncToken,
  getEncryptedVaultCache,
  getVaultSyncToken,
  saveEncryptedVaultCache,
  saveVaultSyncToken,
} from "./lib/storage";
import { getServerSettings } from "./lib/storage";

// Store the latest fill request so the popup can pick it up when opened
let pendingFillRequest: AutofillRequest | null = null;

/**
 * Basic validation for messages coming from content scripts.
 * Prevents malicious pages from easily spoofing fill requests.
 */
function isValidContentScriptSender(sender: chrome.runtime.MessageSender): boolean {
  if (!sender.tab?.url) return false;
  const url = sender.tab.url;
  return url.startsWith("http://") || url.startsWith("https://");
}

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ) => {
    const msg = message as { type: string } & Partial<AutofillRequest>;

    if (msg.type === "INDICATOR_CLICKED" && msg.hostname && msg.fieldType) {
      if (!isValidContentScriptSender(_sender)) {
        console.warn("[VaultLock Background] Rejected INDICATOR_CLICKED from invalid sender");
        sendResponse({ success: false, error: "Invalid sender" });
        return;
      }

      const request: AutofillRequest = {
        hostname: msg.hostname,
        fieldType: msg.fieldType,
        associatedFieldId: msg.associatedFieldId,
      };

      pendingFillRequest = request;

      // Store in session storage so popup can read it even if background restarts
      chrome.storage.session.set({ pendingFillRequest });

      // Try to open the popup (requires user gesture - clicking the indicator counts)
      chrome.action.openPopup().catch(() => {
        // If openPopup fails (some Chrome versions), user can open manually
      });

      sendResponse({ success: true });
    }

    // Allow async response if needed later
    return true;
  },
);

// Allow the popup to fetch the pending request
chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ) => {
    const msg = message as { type?: string };

    if (msg.type === "GET_PENDING_FILL_REQUEST") {
      chrome.storage.session
        .get("pendingFillRequest")
        .then((result: { pendingFillRequest?: unknown }) => {
          sendResponse(result.pendingFillRequest || null);
        });
      return true;
    }

    if (msg.type === "CLEAR_PENDING_FILL_REQUEST") {
      pendingFillRequest = null;
      chrome.storage.session.remove("pendingFillRequest");
      sendResponse({ success: true });
    }
  },
);

/**
 * Background sync entry point (12-08).
 * Fetches encrypted deltas using the access token and persists the raw
 * encrypted responses + sync token. Decryption only happens in the popup
 * (where the DEK is available after unlock). This respects MV3 context
 * isolation and the zero-knowledge model.
 */
async function performVaultSync(forceFull = false): Promise<void> {
  const session = await getAuthSession();
  if (!session) return;

  const serverSettings = await getServerSettings();
  const client = new VaultlockApiClient({
    baseUrl: serverSettings.serverUrl,
    fetch: createTimedFetch(serverSettings.requestTimeoutMs),
  });

  try {
    const since = forceFull ? undefined : ((await getVaultSyncToken()) ?? undefined);

    const response = await client.listVaultItems(session.accessToken, since);

    // Merge with existing encrypted cache
    const existing = await getEncryptedVaultCache();
    const existingItems = existing?.items ?? [];

    // Simple merge by id + updatedAt (same logic as mergeVaultItems but on encrypted responses)
    const byId = new Map(existingItems.map((item) => [item.id, item]));
    for (const item of response.items) {
      const prev = byId.get(item.id);
      if (!prev || item.updated_at >= prev.updated_at) {
        byId.set(item.id, item);
      }
    }
    const mergedItems: VaultItemResponse[] = Array.from(byId.values());

    const newCache = {
      items: mergedItems,
      syncToken: response.sync_token,
      updatedAt: Date.now(),
    };

    await saveEncryptedVaultCache(newCache);
    if (response.sync_token) {
      await saveVaultSyncToken(response.sync_token);
    }

    // Notify popup that new encrypted data is available
    chrome.runtime
      .sendMessage({
        type: "ENCRYPTED_VAULT_CACHE_UPDATED",
        itemCount: mergedItems.length,
      })
      .catch(() => {});
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status === 400 && !forceFull) {
      // Stale token — clear cache + token and retry full
      await clearEncryptedVaultCacheAndToken();
      await performVaultSync(true);
      return;
    }
    console.error("[VaultLock Background] Encrypted vault sync failed", err);
  }
}

async function clearEncryptedVaultCacheAndToken(): Promise<void> {
  try {
    await clearEncryptedVaultCache();
    await clearVaultSyncToken();
  } catch {
    // ignore – best effort
  }
}

// Allow popup (or other contexts) to explicitly request a sync
chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ) => {
    const msg = message as { type?: string };

    if (msg.type === "TRIGGER_VAULT_SYNC") {
      performVaultSync(false).finally(async () => {
        const cache = await getEncryptedVaultCache();
        sendResponse({ success: true, itemCount: cache?.items.length ?? 0 });
      });
      return true;
    }

    if (msg.type === "GET_ENCRYPTED_VAULT_CACHE") {
      getEncryptedVaultCache().then((cache) => {
        sendResponse(cache ?? { items: [], syncToken: null });
      });
      return true;
    }

    if (msg.type === "VAULT_LOCKED") {
      // We keep the encrypted cache on disk for fast resume after re-unlock.
      // Nothing to clear in-memory anymore (we removed the broken variables).
      sendResponse({ success: true });
    }
  },
);

// Best-effort initial sync on service worker startup (when the worker happens to stay alive across browser restarts)
chrome.runtime.onStartup.addListener(() => {
  performVaultSync(false).catch(() => {});
});
