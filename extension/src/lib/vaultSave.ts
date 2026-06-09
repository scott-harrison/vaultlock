import { VaultlockApiClient } from "@vaultlock/shared/api";
import { findMatchingLoginCredential } from "@vaultlock/shared/login-save-match";
import type { LoginItemPlaintext, VaultItemResponse } from "@vaultlock/shared/types";
import { getAuthSession } from "./auth";
import { createTimedFetch } from "./serverSettings";
import { getEncryptedVaultCache, getServerSettings, saveEncryptedVaultCache } from "./storage";
import { decryptVaultItem, encryptVaultItemPlaintext } from "./vaultCrypto";
import { isVaultUnlocked } from "./vaultDekState";
import type { DecryptedVaultItem } from "./vaultItems";

function mergeCreatedItem(
  cacheItems: VaultItemResponse[],
  created: VaultItemResponse,
): VaultItemResponse[] {
  const byId = new Map(cacheItems.map((item) => [item.id, item]));
  byId.set(created.id, created);
  return Array.from(byId.values());
}

export function findMatchingLoginItem(
  username: string,
  pageUrl: string,
  items: DecryptedVaultItem[],
): DecryptedVaultItem | null {
  const loginItems = items
    .filter((item) => item.itemType === "login")
    .map((item) => ({
      id: item.id,
      plaintext: item.plaintext as LoginItemPlaintext,
    }));

  const match = findMatchingLoginCredential(username, pageUrl, loginItems);
  if (!match) {
    return null;
  }

  return items.find((item) => item.id === match.id) ?? null;
}

export async function createLoginVaultItem(
  plaintext: LoginItemPlaintext,
): Promise<DecryptedVaultItem> {
  if (!isVaultUnlocked()) {
    throw new Error("Vault is locked. Unlock VaultLock before saving.");
  }

  const session = await getAuthSession();
  if (!session) {
    throw new Error("Sign in to VaultLock before saving.");
  }

  const serverSettings = await getServerSettings();
  const client = new VaultlockApiClient({
    baseUrl: serverSettings.serverUrl,
    fetch: createTimedFetch(serverSettings.requestTimeoutMs),
  });

  const encrypted = await encryptVaultItemPlaintext(plaintext);
  const created = await client.createVaultItem(session.accessToken, {
    item_type: "login",
    encrypted_data: encrypted.encrypted_data,
    nonce: encrypted.nonce,
  });

  const cache = await getEncryptedVaultCache();
  await saveEncryptedVaultCache({
    items: mergeCreatedItem(cache?.items ?? [], created),
    syncToken: cache?.syncToken ?? null,
    updatedAt: Date.now(),
  });

  chrome.runtime.sendMessage({ type: "ENCRYPTED_VAULT_CACHE_UPDATED" }).catch(() => {});

  return {
    id: created.id,
    itemType: created.item_type,
    createdAt: created.created_at,
    updatedAt: created.updated_at,
    plaintext: await decryptVaultItem(created),
  };
}

export async function updateLoginVaultItem(
  itemId: string,
  plaintext: LoginItemPlaintext,
): Promise<DecryptedVaultItem> {
  if (!isVaultUnlocked()) {
    throw new Error("Vault is locked. Unlock VaultLock before saving.");
  }

  const session = await getAuthSession();
  if (!session) {
    throw new Error("Sign in to VaultLock before saving.");
  }

  const serverSettings = await getServerSettings();
  const client = new VaultlockApiClient({
    baseUrl: serverSettings.serverUrl,
    fetch: createTimedFetch(serverSettings.requestTimeoutMs),
  });

  const encrypted = await encryptVaultItemPlaintext(plaintext);
  const updated = await client.updateVaultItem(session.accessToken, itemId, {
    item_type: "login",
    encrypted_data: encrypted.encrypted_data,
    nonce: encrypted.nonce,
  });

  const cache = await getEncryptedVaultCache();
  await saveEncryptedVaultCache({
    items: mergeCreatedItem(cache?.items ?? [], updated),
    syncToken: cache?.syncToken ?? null,
    updatedAt: Date.now(),
  });

  chrome.runtime.sendMessage({ type: "ENCRYPTED_VAULT_CACHE_UPDATED" }).catch(() => {});

  return {
    id: updated.id,
    itemType: updated.item_type,
    createdAt: updated.created_at,
    updatedAt: updated.updated_at,
    plaintext: await decryptVaultItem(updated),
  };
}
