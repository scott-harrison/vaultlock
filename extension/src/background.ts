/**
 * Background service worker for the VaultLock extension.
 *
 * Responsibilities:
 * - Message passing between content scripts and popup for autofill ("fill on click")
 * - Storing pending fill requests (hostname + field context)
 * - Background vault sync (encrypted cache only; decryption in popup)
 */

import { VaultlockApiClient } from "@vaultlock/shared/api";
import type { VaultItemResponse } from "@vaultlock/shared/types";
import { getAuthSession } from "./lib/auth";
import { getStorageSession } from "./lib/browser";
import {
  hostnamesMatch,
  isExtensionPrivilegedSender,
  isTrustedContentScriptSender,
  rejectUntrustedSender,
  tabHostnameFromSender,
} from "./lib/messageSenderValidation";
import type { AutofillRequest, ExecuteFillPayload, SaveLoginCandidate } from "./lib/messaging";
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

let pendingFillRequest: AutofillRequest | null = null;
let pendingSaveLogin: SaveLoginCandidate | null = null;
let vaultSyncInFlight: Promise<void> | null = null;

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ) => {
    const msg = message as { type: string } & Partial<AutofillRequest>;

    if (msg.type !== "INDICATOR_CLICKED") {
      return;
    }

    if (!isTrustedContentScriptSender(sender)) {
      return rejectUntrustedSender(
        sender,
        sendResponse,
        "INDICATOR_CLICKED from non-content-script",
      );
    }

    if (!msg.hostname || !msg.fieldType) {
      sendResponse({ success: false, error: "Invalid request" });
      return true;
    }

    const tabHost = tabHostnameFromSender(sender);
    if (!tabHost || !hostnamesMatch(msg.hostname, tabHost)) {
      return rejectUntrustedSender(sender, sendResponse, "INDICATOR_CLICKED hostname mismatch");
    }

    const tabId = sender.tab?.id;
    if (tabId === undefined) {
      sendResponse({ success: false, error: "Missing tab context" });
      return true;
    }

    const request: AutofillRequest = {
      hostname: msg.hostname,
      fieldType: msg.fieldType,
      associatedFieldId: msg.associatedFieldId,
      tabId,
    };

    pendingFillRequest = request;
    getStorageSession()?.set({ pendingFillRequest });

    chrome.action.openPopup().catch(() => {});

    sendResponse({ success: true });
    return true;
  },
);

const CONTENT_SCRIPT_MESSAGE_TYPES = new Set([
  "CHECK_SAVE_LOGIN_AVAILABLE",
  "SAVE_LOGIN_CANDIDATE",
]);

const EXTENSION_ONLY_MESSAGE_TYPES = new Set([
  "GET_PENDING_FILL_REQUEST",
  "CLEAR_PENDING_FILL_REQUEST",
  "EXECUTE_FILL",
  "TRIGGER_VAULT_SYNC",
  "GET_ENCRYPTED_VAULT_CACHE",
  "VAULT_LOCKED",
  "GET_PENDING_SAVE_LOGIN",
  "CLEAR_PENDING_SAVE_LOGIN",
]);

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ) => {
    const msg = message as { type?: string };

    if (msg.type && CONTENT_SCRIPT_MESSAGE_TYPES.has(msg.type)) {
      if (!isTrustedContentScriptSender(sender)) {
        return rejectUntrustedSender(sender, sendResponse, `${msg.type} from non-content-script`);
      }

      if (msg.type === "CHECK_SAVE_LOGIN_AVAILABLE") {
        void getAuthSession().then((session) => {
          sendResponse({ authenticated: Boolean(session) });
        });
        return true;
      }

      if (msg.type === "SAVE_LOGIN_CANDIDATE") {
        const candidate = (message as { candidate?: SaveLoginCandidate }).candidate;
        const tabHost = tabHostnameFromSender(sender);

        if (!candidate?.hostname || !candidate.password || !tabHost) {
          sendResponse({ success: false, error: "Invalid save candidate" });
          return true;
        }

        if (!hostnamesMatch(candidate.hostname, tabHost)) {
          return rejectUntrustedSender(
            sender,
            sendResponse,
            "SAVE_LOGIN_CANDIDATE hostname mismatch",
          );
        }

        pendingSaveLogin = candidate;
        getStorageSession()?.set({ pendingSaveLogin });
        chrome.action.openPopup().catch(() => {});
        sendResponse({ success: true });
        return true;
      }
    }

    if (!msg.type || !EXTENSION_ONLY_MESSAGE_TYPES.has(msg.type)) {
      return;
    }

    if (!isExtensionPrivilegedSender(sender)) {
      return rejectUntrustedSender(sender, sendResponse, `${msg.type} from non-extension`);
    }

    if (msg.type === "GET_PENDING_FILL_REQUEST") {
      const session = getStorageSession();
      if (!session) {
        sendResponse(pendingFillRequest);
        return true;
      }
      session.get("pendingFillRequest").then((result: { pendingFillRequest?: unknown }) => {
        sendResponse(result.pendingFillRequest || null);
      });
      return true;
    }

    if (msg.type === "CLEAR_PENDING_FILL_REQUEST") {
      pendingFillRequest = null;
      getStorageSession()?.remove("pendingFillRequest");
      sendResponse({ success: true });
      return true;
    }

    if (msg.type === "EXECUTE_FILL") {
      void handleExecuteFill(message as ExecuteFillPayload, sendResponse);
      return true;
    }

    if (msg.type === "TRIGGER_VAULT_SYNC") {
      const forceFull = (msg as { forceFull?: boolean }).forceFull === true;
      performVaultSync(forceFull)
        .then(async () => {
          const cache = await getEncryptedVaultCache();
          sendResponse({ success: true, itemCount: cache?.items.length ?? 0 });
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : "Vault sync failed";
          sendResponse({ success: false, error: message });
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
      pendingSaveLogin = null;
      getStorageSession()?.remove("pendingSaveLogin");
      sendResponse({ success: true });
      return true;
    }

    if (msg.type === "GET_PENDING_SAVE_LOGIN") {
      const session = getStorageSession();
      if (!session) {
        sendResponse(pendingSaveLogin);
        return true;
      }
      session.get("pendingSaveLogin").then((result: { pendingSaveLogin?: unknown }) => {
        sendResponse(result.pendingSaveLogin ?? pendingSaveLogin ?? null);
      });
      return true;
    }

    if (msg.type === "CLEAR_PENDING_SAVE_LOGIN") {
      pendingSaveLogin = null;
      getStorageSession()?.remove("pendingSaveLogin");
      sendResponse({ success: true });
      return true;
    }
  },
);

async function handleExecuteFill(
  payload: ExecuteFillPayload,
  sendResponse: (response?: unknown) => void,
): Promise<void> {
  let stored: AutofillRequest | null | undefined = pendingFillRequest ?? undefined;
  if (!stored) {
    const session = getStorageSession();
    if (session) {
      const result = await session.get("pendingFillRequest");
      stored = result.pendingFillRequest as AutofillRequest | undefined;
    }
  }
  const pending = stored;

  if (!pending?.tabId) {
    sendResponse({ success: false, error: "No active fill request" });
    return;
  }

  if (pending.hostname !== payload.hostname) {
    sendResponse({ success: false, error: "Hostname mismatch" });
    return;
  }

  try {
    const tab = await chrome.tabs.get(pending.tabId);
    const tabUrl = tab.url ?? "";
    if (!tabUrl.startsWith("http://") && !tabUrl.startsWith("https://")) {
      sendResponse({ success: false, error: "Invalid tab URL" });
      return;
    }

    const tabHost = new URL(tabUrl).hostname;
    if (tabHost !== payload.hostname) {
      sendResponse({ success: false, error: "Tab hostname mismatch" });
      return;
    }

    const result = await chrome.tabs.sendMessage(pending.tabId, payload);
    if (result && typeof result === "object" && "success" in result && result.success) {
      pendingFillRequest = null;
      getStorageSession()?.remove("pendingFillRequest");
    }
    sendResponse(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fill fields";
    sendResponse({ success: false, error: message });
  }
}

async function performVaultSync(forceFull = false): Promise<void> {
  if (vaultSyncInFlight) {
    return vaultSyncInFlight;
  }

  vaultSyncInFlight = performVaultSyncInner(forceFull).finally(() => {
    vaultSyncInFlight = null;
  });

  return vaultSyncInFlight;
}

async function performVaultSyncInner(forceFull = false): Promise<void> {
  const session = await getAuthSession();
  if (!session) return;

  const serverSettings = await getServerSettings();
  const client = new VaultlockApiClient({
    baseUrl: serverSettings.serverUrl,
    fetch: createTimedFetch(serverSettings.requestTimeoutMs),
  });

  try {
    const existing = await getEncryptedVaultCache();
    const existingItems = existing?.items ?? [];
    const since = forceFull ? undefined : ((await getVaultSyncToken()) ?? undefined);

    const response = await client.listVaultItems(session.accessToken, since);

    const byId = new Map(existingItems.map((item) => [item.id, item]));
    for (const item of response.items) {
      const prev = byId.get(item.id);
      if (!prev || item.updated_at >= prev.updated_at) {
        byId.set(item.id, item);
      }
    }
    const mergedItems: VaultItemResponse[] = Array.from(byId.values());

    const syncToken = response.sync_token ?? since ?? existing?.syncToken ?? null;
    const hadChanges =
      forceFull ||
      response.items.length > 0 ||
      mergedItems.length !== existingItems.length ||
      syncToken !== (existing?.syncToken ?? null);

    const newCache = {
      items: mergedItems,
      syncToken,
      updatedAt: Date.now(),
    };

    await saveEncryptedVaultCache(newCache);
    if (syncToken) {
      await saveVaultSyncToken(syncToken);
    }

    if (hadChanges) {
      chrome.runtime
        .sendMessage({
          type: "ENCRYPTED_VAULT_CACHE_UPDATED",
          itemCount: mergedItems.length,
        })
        .catch(() => {});
    }
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status === 400 && !forceFull) {
      await clearEncryptedVaultCacheAndToken();
      await performVaultSyncInner(true);
      return;
    }
    console.error("[VaultLock Background] Encrypted vault sync failed", err);
    throw err;
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
