/**
 * Vault item presentation helpers for the browser extension popup.
 *
 * Network fetch + encrypted cache merge run in the background service worker;
 * the popup decrypts cached ciphertext after unlock.
 */

import type {
  CardItemPlaintext,
  LoginItemPlaintext,
  NoteItemPlaintext,
  VaultItemPlaintext,
  VaultItemType,
} from "@vaultlock/shared/types";

export interface DecryptedVaultItem {
  id: string;
  itemType: VaultItemType;
  createdAt: string;
  updatedAt: string;
  plaintext: VaultItemPlaintext;
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
