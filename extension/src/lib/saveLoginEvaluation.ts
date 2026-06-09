import {
  type VaultLoginItemRef,
  evaluateSaveLoginDecision,
} from "@vaultlock/shared/login-save-match";
import type { LoginItemPlaintext, VaultItemResponse } from "@vaultlock/shared/types";
import type { SaveLoginCandidate, SaveLoginEvaluation } from "./messaging";
import { getEncryptedVaultCache } from "./storage";
import { applyUnlockedDek } from "./vaultDekLifecycle";
import { loadDekFromSession } from "./vaultDekSession";
import { isVaultUnlocked } from "./vaultDekState";
import { decryptVaultItem } from "./vaultItemCrypto";
import { isVaultUnlockedInSession } from "./vaultUnlockSession";

function toLoginItemRef(item: VaultItemResponse, plaintext: LoginItemPlaintext): VaultLoginItemRef {
  return { id: item.id, plaintext };
}

async function ensureDecryptionReady(): Promise<"ready" | "locked" | "unavailable"> {
  if (!isVaultUnlocked()) {
    const sessionDek = await loadDekFromSession();
    if (sessionDek) {
      applyUnlockedDek(sessionDek);
    }
  }

  if (isVaultUnlocked()) {
    return "ready";
  }

  if (!(await isVaultUnlockedInSession())) {
    return "locked";
  }

  chrome.runtime.sendMessage({ type: "REQUEST_VAULT_DEK_SYNC" }).catch(() => {});
  return "unavailable";
}

export async function evaluateSaveLoginCandidate(
  candidate: SaveLoginCandidate,
): Promise<SaveLoginEvaluation> {
  const readiness = await ensureDecryptionReady();
  if (readiness === "locked") {
    return { action: "locked" };
  }

  if (readiness === "unavailable") {
    return { action: "unavailable" };
  }

  const cache = await getEncryptedVaultCache();
  const encryptedItems = cache?.items ?? [];
  if (encryptedItems.length === 0) {
    return { action: "save" };
  }

  const loginItems: VaultLoginItemRef[] = [];
  for (const item of encryptedItems) {
    if (item.item_type !== "login") {
      continue;
    }

    try {
      const plaintext = (await decryptVaultItem(item)) as LoginItemPlaintext;
      loginItems.push(toLoginItemRef(item, plaintext));
    } catch {
      // Skip items that cannot be decrypted with the current unlock key.
    }
  }

  const decision = evaluateSaveLoginDecision(candidate, loginItems);
  if (decision.kind === "skip") {
    return { action: "skip" };
  }
  if (decision.kind === "save") {
    return { action: "save" };
  }
  return { action: "update", existingItemId: decision.itemId };
}
