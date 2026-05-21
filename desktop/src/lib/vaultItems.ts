import type {
  LoginItemPlaintext,
  NoteItemPlaintext,
  VaultItemPlaintext,
  VaultItemType,
} from "@vaultlock/shared/types";
import { createApiClient } from "./apiClient";
import { decryptVaultItem, encryptVaultItemPlaintext } from "./vaultCrypto";

export interface DecryptedVaultItem {
  id: string;
  itemType: VaultItemType;
  createdAt: string;
  updatedAt: string;
  plaintext: VaultItemPlaintext;
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

export async function listDecryptedVaultItems(accessToken: string): Promise<DecryptedVaultItem[]> {
  const client = await createApiClient();
  const response = await client.listVaultItems(accessToken);

  const items = await Promise.all(
    response.items.map(async (item) => ({
      id: item.id,
      itemType: item.item_type,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      plaintext: await decryptVaultItem(item),
    })),
  );

  return items.sort((left, right) =>
    vaultItemDisplayTitle(left).localeCompare(vaultItemDisplayTitle(right)),
  );
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
