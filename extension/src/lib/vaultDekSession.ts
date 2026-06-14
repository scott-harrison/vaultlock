import { getStorageSession } from "./browser";

const DEK_SESSION_KEY = "vaultSessionDek";

export async function persistDekToSession(dek: Uint8Array): Promise<void> {
  try {
    await getStorageSession()?.set({ [DEK_SESSION_KEY]: Array.from(dek) });
  } catch {
    // ignore
  }
}

export async function loadDekFromSession(): Promise<Uint8Array | null> {
  try {
    const result = await getStorageSession()?.get(DEK_SESSION_KEY);
    const stored = result?.[DEK_SESSION_KEY];
    if (!Array.isArray(stored) || stored.length !== 32) {
      return null;
    }
    return new Uint8Array(stored);
  } catch {
    return null;
  }
}

export async function clearDekFromSession(): Promise<void> {
  try {
    await getStorageSession()?.remove(DEK_SESSION_KEY);
  } catch {
    // ignore
  }
}
