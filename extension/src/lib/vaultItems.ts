/**
 * Vault items logic for the browser extension (12-05+).
 *
 * Handles fetching encrypted items from the backend,
 * decrypting them using the current DEK, and basic sync.
 */

import { VaultlockApiClient } from "@vaultlock/shared/api";
import type { VaultItemListResponse, VaultItemResponse } from "@vaultlock/shared/types";

import { getAuthSession } from "./auth";
import { createTimedFetch } from "./serverSettings";
import { getServerSettings } from "./storage";
import { decryptVaultItem } from "./vaultCrypto";

export interface DecryptedVaultItem {
  id: string;
  itemType: string;
  createdAt: string;
  updatedAt: string;
  // biome-ignore lint/suspicious/noExplicitAny: will be strongly typed later
  plaintext: Record<string, any>; // Will be more strongly typed later
}

export async function fetchAndDecryptVaultItems(since?: string): Promise<DecryptedVaultItem[]> {
  const session = await getAuthSession();
  if (!session) {
    throw new Error("Not authenticated");
  }

  const serverSettings = await getServerSettings();

  const client = new VaultlockApiClient({
    baseUrl: serverSettings.serverUrl,
    fetch: createTimedFetch(serverSettings.requestTimeoutMs),
  });

  const response: VaultItemListResponse = await client.listVaultItems(session.accessToken, since);

  const decryptedItems: DecryptedVaultItem[] = [];

  for (const item of response.items) {
    try {
      // biome-ignore lint/suspicious/noExplicitAny: temporary until types are tightened
      const plaintext = await decryptVaultItem(item as any); // TODO: improve typing once VaultItemResponse is stricter
      decryptedItems.push({
        id: item.id,
        itemType: item.item_type,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        plaintext,
      });
    } catch (err) {
      console.warn(`Failed to decrypt item ${item.id}`, err);
    }
  }

  return decryptedItems;
}

export function sortVaultItems(items: DecryptedVaultItem[]): DecryptedVaultItem[] {
  return [...items].sort((a, b) => {
    const titleA = getDisplayTitle(a).toLowerCase();
    const titleB = getDisplayTitle(b).toLowerCase();
    return titleA.localeCompare(titleB);
  });
}

export function getDisplayTitle(item: DecryptedVaultItem): string {
  const p = item.plaintext;
  if (item.itemType === "login") {
    return p.title || p.username || p.url || "Login";
  }
  if (item.itemType === "note") {
    return p.title || (p.content ? p.content.slice(0, 40) : "Note");
  }
  return p.title || "Item";
}

export function getDisplaySubtitle(item: DecryptedVaultItem): string | null {
  const p = item.plaintext;
  if (item.itemType === "login") {
    return p.username || p.url || null;
  }
  return null;
}
