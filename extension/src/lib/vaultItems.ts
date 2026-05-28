/**
 * Vault items logic for the browser extension (12-05+).
 *
 * Handles fetching encrypted items from the backend,
 * decrypting them using the current DEK, and basic sync.
 */

import { VaultlockApiClient } from "@vaultlock/shared/api";
import type {
  VaultItemListResponse,
  VaultItemPlaintext,
  VaultItemResponse,
  VaultItemType,
} from "@vaultlock/shared/types";

import { getAuthSession } from "./auth";
import { createTimedFetch } from "./serverSettings";
import { getServerSettings } from "./storage";
import { decryptVaultItem } from "./vaultCrypto";

export interface DecryptedVaultItem {
  id: string;
  itemType: VaultItemType;
  createdAt: string;
  updatedAt: string;
  plaintext: VaultItemPlaintext;
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
      const plaintext = await decryptVaultItem(item);
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
    const login = p as import("@vaultlock/shared/types").LoginItemPlaintext;
    return login.title || login.username || login.url || "Login";
  }

  if (item.itemType === "note") {
    const note = p as import("@vaultlock/shared/types").NoteItemPlaintext;
    return note.title || (note.content ? note.content.slice(0, 40) : "Note");
  }

  const card = p as import("@vaultlock/shared/types").CardItemPlaintext;
  return card.title || "Item";
}

export function getDisplaySubtitle(item: DecryptedVaultItem): string | null {
  if (item.itemType === "login") {
    const login = item.plaintext as import("@vaultlock/shared/types").LoginItemPlaintext;
    return login.username || login.url || null;
  }
  return null;
}
