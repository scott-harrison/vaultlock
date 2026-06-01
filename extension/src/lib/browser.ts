/**
 * Cross-browser extension API access (Chrome, Brave, Firefox).
 */

type StorageArea = chrome.storage.StorageArea;

function extensionApi(): typeof chrome {
  const api = globalThis.chrome ?? (globalThis as { browser?: typeof chrome }).browser;
  if (!api) {
    throw new Error("Extension APIs are unavailable in this context.");
  }
  return api;
}

export function getStorageLocal(): StorageArea {
  const storage = extensionApi().storage;
  if (!storage?.local) {
    throw new Error(
      'Extension storage is unavailable. Reload the extension in brave://extensions (or chrome://extensions) after rebuilding — the manifest must include the "storage" permission.',
    );
  }
  return storage.local;
}

export function getStorageSync(): StorageArea | undefined {
  return extensionApi().storage?.sync;
}

export function getStorageSession(): StorageArea | undefined {
  return extensionApi().storage?.session;
}
