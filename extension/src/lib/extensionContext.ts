const CONTEXT_INVALIDATED = "Extension context invalidated";

export function isContextInvalidatedError(error: unknown): boolean {
  return error instanceof Error && error.message.includes(CONTEXT_INVALIDATED);
}

export function isExtensionContextValid(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

export function safeSendMessage(message: unknown): void {
  try {
    void chrome.runtime.sendMessage(message);
  } catch (error) {
    if (!isContextInvalidatedError(error)) {
      throw error;
    }
  }
}

export async function safeSessionStorageSet(items: Record<string, unknown>): Promise<void> {
  try {
    await chrome.storage.session.set(items);
  } catch (error) {
    if (!isContextInvalidatedError(error)) {
      throw error;
    }
  }
}

/**
 * Plasmo dev injects an HMR runtime that calls chrome.runtime.connect on an
 * interval. After the extension reloads, stale tabs throw "Extension context
 * invalidated". Wrap connect so those reconnect attempts fail quietly.
 */
export function installRuntimeConnectGuard(): void {
  const runtime = chrome.runtime;
  const nativeConnect = runtime.connect.bind(runtime);

  runtime.connect = ((...args: Parameters<typeof runtime.connect>) => {
    try {
      return nativeConnect(...args);
    } catch (error) {
      if (isContextInvalidatedError(error)) {
        notifyContextInvalidated();
        return createDeadPort();
      }
      throw error;
    }
  }) as typeof runtime.connect;
}

function createDeadPort(): chrome.runtime.Port {
  const noop = () => {};
  const listeners = {
    addListener: noop,
    removeListener: noop,
    hasListener: () => false,
  };

  return {
    name: "",
    disconnect: noop,
    postMessage: noop,
    onDisconnect: listeners,
    onMessage: listeners,
  };
}

export const EXTENSION_CONTEXT_INVALIDATED_EVENT = "vaultlock:extension-context-invalidated";

export function notifyContextInvalidated(): void {
  window.dispatchEvent(new CustomEvent(EXTENSION_CONTEXT_INVALIDATED_EVENT));
}

export function onExtensionContextInvalidated(listener: () => void): () => void {
  window.addEventListener(EXTENSION_CONTEXT_INVALIDATED_EVENT, listener);
  return () => window.removeEventListener(EXTENSION_CONTEXT_INVALIDATED_EVENT, listener);
}
