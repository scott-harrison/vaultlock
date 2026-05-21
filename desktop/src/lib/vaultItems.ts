import { VaultlockApiError } from "@vaultlock/shared/api";
import type { VaultItemListResponse, VaultItemResponse } from "@vaultlock/shared/types";
import type {
  LoginItemPlaintext,
  NoteItemPlaintext,
  VaultItemPlaintext,
  VaultItemType,
} from "@vaultlock/shared/types";
import { createApiClient } from "./apiClient";
import { decryptVaultItem, encryptVaultItemPlaintext } from "./vaultCrypto";
import {
  clearVaultSyncToken,
  loadVaultSyncToken,
  maxSyncToken,
  saveVaultSyncToken,
} from "./vaultSync";

export interface DecryptedVaultItem {
  id: string;
  itemType: VaultItemType;
  createdAt: string;
  updatedAt: string;
  plaintext: VaultItemPlaintext;
}

export interface VaultItemsFetchResult {
  items: DecryptedVaultItem[];
  syncToken: string | null;
}

export interface VaultSyncResult {
  items: DecryptedVaultItem[];
  changed: boolean;
}

export function vaultItemDisplayTitle(item: DecryptedVaultItem): string {
  const { plaintext, itemType } = item;

  if (itemType === "login") {
    const login = plaintext as LoginItemPlaintext;
    return login.title?.trim() || login.username?.trim() || login.url?.trim() || "Login";
  }

  if (itemType === "note") {
    const note = plaintext as NoteItemPlaintext;
    const content = note.content?.trim();
    return note.title?.trim() || (content ? content.slice(0, 48) : "Note");
  }

  const card = plaintext as { title?: string; cardholder?: string };
  return card.title?.trim() || card.cardholder?.trim() || "Card";
}

export function vaultItemDisplaySubtitle(item: DecryptedVaultItem): string | null {
  if (item.itemType === "login") {
    const login = item.plaintext as LoginItemPlaintext;
    if (login.username?.trim()) {
      return login.username.trim();
    }
    if (login.url?.trim()) {
      return login.url.trim();
    }
  }

  if (item.itemType === "note") {
    return "Secure note";
  }

  return item.itemType.charAt(0).toUpperCase() + item.itemType.slice(1);
}

function sortVaultItems(items: DecryptedVaultItem[]): DecryptedVaultItem[] {
  return [...items].sort((left, right) =>
    vaultItemDisplayTitle(left).localeCompare(vaultItemDisplayTitle(right)),
  );
}

async function decryptVaultItems(items: VaultItemResponse[]): Promise<DecryptedVaultItem[]> {
  return Promise.all(
    items.map(async (item) => ({
      id: item.id,
      itemType: item.item_type,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      plaintext: await decryptVaultItem(item),
    })),
  );
}

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

export function syncTokenFromItems(items: DecryptedVaultItem[]): string | null {
  return maxSyncToken(
    null,
    items.map((item) => item.updatedAt),
  );
}

export async function fetchDecryptedVaultItems(
  accessToken: string,
  since?: string,
): Promise<VaultItemsFetchResult> {
  const client = await createApiClient();
  const response = await client.listVaultItems(accessToken, since);
  const items = await decryptVaultItemsFromResponse(response);
  return { items, syncToken: response.sync_token };
}

async function decryptVaultItemsFromResponse(
  response: VaultItemListResponse,
): Promise<DecryptedVaultItem[]> {
  return sortVaultItems(await decryptVaultItems(response.items));
}

export async function loadVaultItems(
  accessToken: string,
  email: string,
): Promise<DecryptedVaultItem[]> {
  const { items, syncToken } = await fetchDecryptedVaultItems(accessToken);
  if (syncToken) {
    await saveVaultSyncToken(email, syncToken);
  } else {
    await clearVaultSyncToken(email);
  }
  return items;
}

export async function syncVaultItems(
  accessToken: string,
  email: string,
  currentItems: DecryptedVaultItem[],
): Promise<VaultSyncResult> {
  if (currentItems.length === 0) {
    const items = await loadVaultItems(accessToken, email);
    return { items, changed: true };
  }

  const storedToken = await loadVaultSyncToken(email);

  if (!storedToken) {
    const items = await loadVaultItems(accessToken, email);
    return { items, changed: true };
  }

  try {
    const { items: changes, syncToken } = await fetchDecryptedVaultItems(accessToken, storedToken);

    if (changes.length === 0 && !syncToken) {
      return { items: currentItems, changed: false };
    }

    const merged = mergeVaultItems(currentItems, changes);
    const nextToken = maxSyncToken(storedToken, [syncToken, syncTokenFromItems(changes)]);
    if (nextToken) {
      await saveVaultSyncToken(email, nextToken);
    }

    return { items: merged, changed: true };
  } catch (error) {
    if (error instanceof VaultlockApiError && error.status === 400) {
      await clearVaultSyncToken(email);
      return syncVaultItems(accessToken, email, currentItems);
    }
    throw error;
  }
}

export async function recordLocalVaultMutation(
  email: string,
  items: DecryptedVaultItem[],
): Promise<void> {
  const nextToken = syncTokenFromItems(items);
  if (nextToken) {
    const stored = await loadVaultSyncToken(email);
    const merged = maxSyncToken(stored, [nextToken]);
    if (merged) {
      await saveVaultSyncToken(email, merged);
    }
  } else {
    await clearVaultSyncToken(email);
  }
}

export async function createVaultItem(
  accessToken: string,
  itemType: VaultItemType,
  plaintext: VaultItemPlaintext,
): Promise<DecryptedVaultItem> {
  const client = await createApiClient();
  const encrypted = await encryptVaultItemPlaintext(plaintext);
  const created = await client.createVaultItem(accessToken, {
    item_type: itemType,
    encrypted_data: encrypted.encrypted_data,
    nonce: encrypted.nonce,
  });

  return {
    id: created.id,
    itemType: created.item_type,
    createdAt: created.created_at,
    updatedAt: created.updated_at,
    plaintext: await decryptVaultItem(created),
  };
}

export async function updateVaultItem(
  accessToken: string,
  itemId: string,
  itemType: VaultItemType,
  plaintext: VaultItemPlaintext,
): Promise<DecryptedVaultItem> {
  const client = await createApiClient();
  const encrypted = await encryptVaultItemPlaintext(plaintext);
  const updated = await client.updateVaultItem(accessToken, itemId, {
    item_type: itemType,
    encrypted_data: encrypted.encrypted_data,
    nonce: encrypted.nonce,
  });

  return {
    id: updated.id,
    itemType: updated.item_type,
    createdAt: updated.created_at,
    updatedAt: updated.updated_at,
    plaintext: await decryptVaultItem(updated),
  };
}

export async function deleteVaultItem(accessToken: string, itemId: string): Promise<void> {
  const client = await createApiClient();
  await client.deleteVaultItem(accessToken, itemId);
}
