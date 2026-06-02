/**
 * Vault items logic for the browser extension.
 *
 * Handles fetching encrypted items from the backend,
 * decrypting them using the current DEK, and basic sync.
 */

import { VaultlockApiClient } from "@vaultlock/shared/api";
import type {
  CardItemPlaintext,
  LoginItemPlaintext,
  NoteItemPlaintext,
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

export async function fetchAndDecryptVaultItems(since?: string): Promise<{
  items: DecryptedVaultItem[];
  syncToken: string | null;
}> {
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
      console.warn(
        `Failed to decrypt item ${item.id}. This device does not have the encryption key used to create it on another device.`,
        err,
      );
    }
  }

  return {
    items: decryptedItems,
    syncToken: response.sync_token,
  };
}

/**
 * Performs an incremental (or full) sync against the server and returns
 * the merged result + the new sync token to persist.
 *
 * When `currentItems` is empty or no `since` token exists, this performs a full load.
 * Otherwise it fetches only the delta and merges it client-side.
 */
export async function syncVaultItems(
  currentItems: DecryptedVaultItem[],
  since?: string,
): Promise<{
  items: DecryptedVaultItem[];
  syncToken: string | null;
  changed: boolean;
}> {
  const hasCurrent = currentItems.length > 0;
  const tokenToUse = since ?? undefined;

  // If we have no local state and no token, do a full load
  if (!hasCurrent && !tokenToUse) {
    const full = await fetchAndDecryptVaultItems(undefined);
    return {
      items: sortVaultItems(full.items),
      syncToken: full.syncToken,
      changed: full.items.length > 0,
    };
  }

  const delta = await fetchAndDecryptVaultItems(tokenToUse);

  if (delta.items.length === 0 && !delta.syncToken) {
    return {
      items: currentItems,
      syncToken: since ?? null,
      changed: false,
    };
  }

  const merged = mergeVaultItems(currentItems, delta.items);
  const nextToken = delta.syncToken ?? syncTokenFromItems(merged);

  return {
    items: merged,
    syncToken: nextToken,
    changed: true,
  };
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
    const login = p as LoginItemPlaintext;
    return login.title || login.username || login.url || "Login";
  }

  if (item.itemType === "note") {
    const note = p as NoteItemPlaintext;
    return note.title || (note.content ? note.content.slice(0, 40) : "Note");
  }

  const card = p as CardItemPlaintext;
  return card.title || "Item";
}

export function getDisplaySubtitle(item: DecryptedVaultItem): string | null {
  if (item.itemType === "login") {
    const login = item.plaintext as LoginItemPlaintext;
    return login.username || login.url || null;
  }
  return null;
}

/**
 * Merge a set of existing decrypted vault items with an incremental delta
 * returned from the server (items changed after a `since` token).
 *
 * Server deltas can contain creates, updates, and (in the future) tombstones.
 * We keep the item with the most recent updatedAt for any given id.
 */
export function mergeVaultItems(
  existing: DecryptedVaultItem[],
  changes: DecryptedVaultItem[],
): DecryptedVaultItem[] {
  const byId = new Map(existing.map((item) => [item.id, item]));

  for (const change of changes) {
    const previous = byId.get(change.id);
    if (!previous || change.updatedAt >= previous.updatedAt) {
      byId.set(change.id, change);
    }
  }

  return sortVaultItems([...byId.values()]);
}

/**
 * Derive a sync token from a set of items (the max updatedAt across them).
 * Useful after a full load or after applying local mutations.
 */
export function syncTokenFromItems(items: DecryptedVaultItem[]): string | null {
  if (items.length === 0) return null;
  return (
    items
      .map((i) => i.updatedAt)
      .sort()
      .reverse()[0] ?? null
  );
}
