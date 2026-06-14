/**
 * Validates chrome.runtime.MessageSender for background handlers (#181).
 */

export function isExtensionPrivilegedSender(sender: chrome.runtime.MessageSender): boolean {
  if (!sender.id) {
    return false;
  }

  if (sender.tab === undefined) {
    return true;
  }

  const senderUrl = sender.url ?? "";
  return senderUrl.startsWith(`chrome-extension://${sender.id}/`);
}

export function isTrustedContentScriptSender(sender: chrome.runtime.MessageSender): boolean {
  if (!sender.id) {
    return false;
  }
  if (sender.tab?.id === undefined || sender.frameId === undefined) {
    return false;
  }
  const url = sender.tab.url;
  if (!url) {
    return false;
  }
  return url.startsWith("http://") || url.startsWith("https://");
}

export function tabHostnameFromSender(sender: chrome.runtime.MessageSender): string | null {
  const url = sender.tab?.url;
  if (!url) {
    return null;
  }
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function hostnamesMatch(claimed: string, tabHost: string): boolean {
  return claimed.toLowerCase() === tabHost.toLowerCase();
}

export function rejectUntrustedSender(
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
  reason: string,
): boolean {
  console.warn(`[VaultLock Background] Rejected message: ${reason}`);
  sendResponse({ success: false, error: "Invalid sender" });
  return true;
}
