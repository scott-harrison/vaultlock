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
import { getStorageSession } from "./lib/browser";
import { decryptMatchingLogin, listMatchingLoginsForHost } from "./lib/matchingLogins";
import {
  hostnamesMatch,
  isExtensionPrivilegedSender,
  isTrustedContentScriptSender,
  rejectUntrustedSender,
  tabHostnameFromSender,
} from "./lib/messageSenderValidation";
import type { AutofillRequest, ExecuteFillPayload, SaveLoginCandidate } from "./lib/messaging";
import {
  clearPendingSaveLoginBanner,
  getPendingSaveLoginBanner,
  persistPendingSaveLoginBanner,
} from "./lib/saveLoginBannerSession";
import { evaluateSaveLoginCandidate } from "./lib/saveLoginEvaluation";
import { createTimedFetch } from "./lib/serverSettings";
import { getAuthSession } from "./lib/storage";
import {
  clearEncryptedVaultCache,
  clearVaultSyncToken,
  getEncryptedVaultCache,
  getVaultSyncToken,
  saveEncryptedVaultCache,
  saveVaultSyncToken,
} from "./lib/storage";
import { getServerSettings } from "./lib/storage";
import { isVaultUnlockedInSession } from "./lib/vaultUnlockSession";

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
      triggerFieldId: msg.triggerFieldId,
      tabId,
      frameId: sender.frameId,
    };

    pendingFillRequest = request;
    pendingSaveLogin = null;
    getStorageSession()?.set({ pendingFillRequest });
    getStorageSession()?.remove("pendingSaveLogin");

    chrome.action.openPopup().catch(() => {});

    sendResponse({ success: true });
    return true;
  },
);

const CONTENT_SCRIPT_MESSAGE_TYPES = new Set([
  "CHECK_SAVE_LOGIN_AVAILABLE",
  "EVALUATE_SAVE_LOGIN_CANDIDATE",
  "QUEUE_SAVE_LOGIN_BANNER",
  "PERSIST_SAVE_LOGIN_BANNER",
  "GET_PENDING_SAVE_LOGIN_BANNER",
  "CLEAR_PENDING_SAVE_LOGIN_BANNER",
  "SAVE_LOGIN_CANDIDATE",
  "GET_MATCHING_LOGINS_FOR_HOST",
  "FILL_MATCHING_LOGIN",
]);

async function renderSaveLoginBannerInTopFrame(
  tabId: number,
  candidate: SaveLoginCandidate,
): Promise<void> {
  try {
    await chrome.tabs.sendMessage(
      tabId,
      { type: "RENDER_SAVE_LOGIN_BANNER", candidate },
      { frameId: 0 },
    );
  } catch {
    // Top frame may be navigating; content script will restore on next load.
  }
}

const EXTENSION_ONLY_MESSAGE_TYPES = new Set([
  "GET_PENDING_FILL_REQUEST",
  "CLEAR_PENDING_FILL_REQUEST",
  "EXECUTE_FILL",
  "TRIGGER_VAULT_SYNC",
  "GET_ENCRYPTED_VAULT_CACHE",
  "VAULT_LOCKED",
  "SYNC_VAULT_DEK",
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
        void Promise.all([getAuthSession(), isVaultUnlockedInSession()]).then(
          ([session, unlocked]) => {
            sendResponse({
              authenticated: Boolean(session),
              unlocked,
            });
          },
        );
        return true;
      }

      if (msg.type === "EVALUATE_SAVE_LOGIN_CANDIDATE") {
        const candidate = (message as { candidate?: SaveLoginCandidate }).candidate;
        const tabHost = tabHostnameFromSender(sender);

        if (!candidate?.pageUrl || !candidate.password || !tabHost) {
          sendResponse({ action: "unavailable" });
          return true;
        }

        if (!hostnamesMatch(candidate.hostname, tabHost)) {
          return rejectUntrustedSender(
            sender,
            sendResponse,
            "EVALUATE_SAVE_LOGIN_CANDIDATE hostname mismatch",
          );
        }

        void evaluateSaveLoginCandidate(candidate).then((evaluation) => {
          sendResponse(evaluation);
        });
        return true;
      }

      if (msg.type === "QUEUE_SAVE_LOGIN_BANNER") {
        const candidate = (message as { candidate?: SaveLoginCandidate }).candidate;
        const tabId = sender.tab?.id;
        const tabHost = tabHostnameFromSender(sender);

        if (!candidate?.hostname || !candidate.password || tabId === undefined || !tabHost) {
          sendResponse({ success: false, error: "Invalid save banner request" });
          return true;
        }

        if (!hostnamesMatch(candidate.hostname, tabHost)) {
          return rejectUntrustedSender(
            sender,
            sendResponse,
            "QUEUE_SAVE_LOGIN_BANNER hostname mismatch",
          );
        }

        void persistPendingSaveLoginBanner(tabId, candidate).then(async () => {
          await renderSaveLoginBannerInTopFrame(tabId, candidate);
          sendResponse({ success: true });
        });
        return true;
      }

      if (msg.type === "PERSIST_SAVE_LOGIN_BANNER") {
        const candidate = (message as { candidate?: SaveLoginCandidate }).candidate;
        const tabId = sender.tab?.id;
        const tabHost = tabHostnameFromSender(sender);

        if (!candidate?.hostname || !candidate.password || tabId === undefined || !tabHost) {
          sendResponse({ success: false, error: "Invalid save banner persist request" });
          return true;
        }

        if (!hostnamesMatch(candidate.hostname, tabHost)) {
          return rejectUntrustedSender(
            sender,
            sendResponse,
            "PERSIST_SAVE_LOGIN_BANNER hostname mismatch",
          );
        }

        void persistPendingSaveLoginBanner(tabId, candidate).then(() => {
          sendResponse({ success: true });
        });
        return true;
      }

      if (msg.type === "GET_PENDING_SAVE_LOGIN_BANNER") {
        const tabId = sender.tab?.id;
        if (tabId === undefined) {
          sendResponse(null);
          return true;
        }

        void getPendingSaveLoginBanner(tabId).then((record) => {
          sendResponse(record?.candidate ?? null);
        });
        return true;
      }

      if (msg.type === "CLEAR_PENDING_SAVE_LOGIN_BANNER") {
        const tabId = sender.tab?.id;
        if (tabId === undefined) {
          sendResponse({ success: false, error: "Missing tab context" });
          return true;
        }

        void clearPendingSaveLoginBanner(tabId).then(() => {
          sendResponse({ success: true });
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
        if (sender.tab?.id !== undefined) {
          void clearPendingSaveLoginBanner(sender.tab.id);
        }
        chrome.action.openPopup().catch(() => {});
        sendResponse({ success: true });
        return true;
      }

      if (msg.type === "GET_MATCHING_LOGINS_FOR_HOST") {
        const hostname = (message as { hostname?: string }).hostname;
        const tabHost = tabHostnameFromSender(sender);

        if (!hostname || !tabHost) {
          sendResponse({ status: "unavailable", matches: [] });
          return true;
        }

        if (!hostnamesMatch(hostname, tabHost)) {
          return rejectUntrustedSender(
            sender,
            sendResponse,
            "GET_MATCHING_LOGINS_FOR_HOST hostname mismatch",
          );
        }

        void listMatchingLoginsForHost(hostname).then((result) => {
          sendResponse(result);
        });
        return true;
      }

      if (msg.type === "FILL_MATCHING_LOGIN") {
        const fillRequest = message as {
          hostname?: string;
          itemId?: string;
          fieldType?: "username" | "password";
          associatedFieldId?: string;
          triggerFieldId?: string;
        };
        const tabId = sender.tab?.id;
        const tabHost = tabHostnameFromSender(sender);

        if (
          !fillRequest.hostname ||
          !fillRequest.itemId ||
          !fillRequest.fieldType ||
          tabId === undefined ||
          !tabHost
        ) {
          sendResponse({ success: false, error: "Invalid fill request" });
          return true;
        }

        if (!hostnamesMatch(fillRequest.hostname, tabHost)) {
          return rejectUntrustedSender(
            sender,
            sendResponse,
            "FILL_MATCHING_LOGIN hostname mismatch",
          );
        }

        void (async () => {
          const hostname = fillRequest.hostname;
          const itemId = fillRequest.itemId;
          const fieldType = fillRequest.fieldType;
          if (!hostname || !itemId || !fieldType) {
            sendResponse({ success: false, error: "Invalid fill request" });
            return;
          }

          const login = await decryptMatchingLogin(itemId, hostname);
          if (!login) {
            sendResponse({ success: false, error: "Login not found or vault is locked" });
            return;
          }

          const request: AutofillRequest = {
            hostname,
            fieldType,
            associatedFieldId: fillRequest.associatedFieldId,
            triggerFieldId: fillRequest.triggerFieldId,
            tabId,
            frameId: sender.frameId,
          };

          pendingFillRequest = request;
          pendingSaveLogin = null;
          getStorageSession()?.set({ pendingFillRequest });
          getStorageSession()?.remove("pendingSaveLogin");

          const payload: ExecuteFillPayload = {
            type: "EXECUTE_FILL",
            hostname,
            fieldType,
            associatedFieldId: fillRequest.associatedFieldId,
            triggerFieldId: fillRequest.triggerFieldId,
            username: login.username ?? "",
            password: login.password ?? "",
          };

          try {
            const result = await chrome.tabs.sendMessage(
              tabId,
              payload,
              fillMessageOptions(sender.frameId),
            );
            if (result && typeof result === "object" && "success" in result && result.success) {
              pendingFillRequest = null;
              getStorageSession()?.remove("pendingFillRequest");
            }
            sendResponse(result);
          } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to fill fields";
            sendResponse({ success: false, error: message });
          }
        })();
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
      void import("./lib/vaultDekLifecycle").then(({ clearUnlockedDek }) => {
        clearUnlockedDek();
        pendingSaveLogin = null;
        getStorageSession()?.remove("pendingSaveLogin");
        sendResponse({ success: true });
      });
      return true;
    }

    if (msg.type === "SYNC_VAULT_DEK") {
      if (!isExtensionPrivilegedSender(sender)) {
        return rejectUntrustedSender(
          sender,
          sendResponse,
          "SYNC_VAULT_DEK from non-extension page",
        );
      }

      const dek = (message as { dek?: number[] }).dek;
      if (!Array.isArray(dek) || dek.length !== 32) {
        sendResponse({ success: false, error: "Invalid DEK payload" });
        return true;
      }

      void import("./lib/vaultDekLifecycle").then(({ applyUnlockedDek }) => {
        applyUnlockedDek(new Uint8Array(dek));
        sendResponse({ success: true });
      });
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

function fillMessageOptions(
  frameId: number | undefined,
): chrome.tabs.MessageSendOptions | undefined {
  if (frameId === undefined) {
    return undefined;
  }

  return { frameId };
}

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

    const result = await chrome.tabs.sendMessage(
      pending.tabId,
      payload,
      fillMessageOptions(pending.frameId),
    );
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

function mergeIncrementalVaultItems(
  existingItems: VaultItemResponse[],
  changes: VaultItemResponse[],
): VaultItemResponse[] {
  const byId = new Map(existingItems.map((item) => [item.id, item]));
  for (const item of changes) {
    const prev = byId.get(item.id);
    if (!prev || item.updated_at >= prev.updated_at) {
      byId.set(item.id, item);
    }
  }
  return Array.from(byId.values());
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

    // Full sync replaces the cache so deletions on other clients are reflected.
    // Incremental sync only merges upserts; remote deletes need a full sync.
    const mergedItems: VaultItemResponse[] = since
      ? mergeIncrementalVaultItems(existingItems, response.items)
      : response.items;

    const syncToken = response.sync_token ?? since ?? existing?.syncToken ?? null;
    const hadChanges =
      !since ||
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
