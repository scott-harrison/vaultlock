/**
 * Background service worker for the VaultLock extension.
 *
 * Responsibilities:
 * - Message passing between content scripts and popup for autofill ("fill on click")
 * - Storing pending fill requests (hostname + field context)
 * - Later: background sync, token refresh, etc.
 */

import type { AutofillRequest } from "./lib/messaging";

// Store the latest fill request so the popup can pick it up when opened
let pendingFillRequest: AutofillRequest | null = null;

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ) => {
    const msg = message as { type: string } & Partial<AutofillRequest>;

    if (msg.type === "INDICATOR_CLICKED" && msg.hostname && msg.fieldType) {
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
