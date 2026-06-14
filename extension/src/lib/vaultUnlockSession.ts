import { getStorageSession } from "./browser";

const VAULT_UNLOCKED_SESSION_KEY = "vaultSessionUnlocked";

export async function persistVaultUnlockSession(unlocked: boolean): Promise<void> {
  try {
    await getStorageSession()?.set({ [VAULT_UNLOCKED_SESSION_KEY]: unlocked });
  } catch {
    // ignore
  }
}

export async function isVaultUnlockedInSession(): Promise<boolean> {
  try {
    const result = await getStorageSession()?.get(VAULT_UNLOCKED_SESSION_KEY);
    return result?.[VAULT_UNLOCKED_SESSION_KEY] === true;
  } catch {
    return false;
  }
}
