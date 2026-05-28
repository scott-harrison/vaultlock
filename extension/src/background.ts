/**
 * Background service worker for the VaultLock extension.
 *
 * 12-07+ responsibilities:
 * - Message passing between content scripts and popup for autofill ("fill on click")
 * - Storing pending fill requests (hostname + field context)
 * - Later: background sync, token refresh, etc.
 */

console.log("[VaultLock] Background service worker initialized");

type IndicatorClickedMessage = {
  type: "INDICATOR_CLICKED";
  hostname: string;
  fieldType: "username" | "password";
  associatedFieldId?: string;
};

// Store the latest fill request so the popup can pick it up when opened
let pendingFillRequest: IndicatorClickedMessage | null = null;

chrome.runtime.onMessage.addListener((message: IndicatorClickedMessage, sender, sendResponse) => {
  if (message.type === "INDICATOR_CLICKED") {
    console.log("[VaultLock Background] Indicator clicked:", message);

    pendingFillRequest = {
      ...message,
      hostname: message.hostname || sender.origin || "",
    };

    // Store in session storage so popup can read it even if background restarts
    chrome.storage.session.set({ pendingFillRequest });

    // Try to open the popup (requires user gesture - clicking the indicator counts)
    chrome.action.openPopup().catch(() => {
      // If openPopup fails (some Chrome versions), user can open manually
      console.log("[VaultLock Background] Could not auto-open popup, user can open manually");
    });

    sendResponse({ success: true });
  }

  // Allow async response if needed later
  return true;
});

// Allow the popup to fetch the pending request
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_PENDING_FILL_REQUEST") {
    chrome.storage.session.get("pendingFillRequest").then((result) => {
      sendResponse(result.pendingFillRequest || null);
    });
    return true;
  }

  if (message.type === "CLEAR_PENDING_FILL_REQUEST") {
    pendingFillRequest = null;
    chrome.storage.session.remove("pendingFillRequest");
    sendResponse({ success: true });
  }
});
