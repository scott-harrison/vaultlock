export type VaultItemType = "login" | "note" | "card";

export const VAULT_ITEM_TYPES = [
  "login",
  "note",
  "card",
] as const satisfies readonly VaultItemType[];

export function isVaultItemType(value: string): value is VaultItemType {
  return (VAULT_ITEM_TYPES as readonly string[]).includes(value);
}

export interface LoginItemPlaintext {
  title?: string;
  url?: string;
  username?: string;
  password?: string;
  notes?: string;
  totp?: string;
}

export interface NoteItemPlaintext {
  title?: string;
  content?: string;
}

export interface CardItemPlaintext {
  title?: string;
  cardholder?: string;
  number?: string;
  expiry?: string;
  cvv?: string;
}

export type VaultItemPlaintext = LoginItemPlaintext | NoteItemPlaintext | CardItemPlaintext;

export interface VaultItemResponse {
  id: string;
  item_type: VaultItemType;
  encrypted_data: string;
  nonce: string;
  created_at: string;
  updated_at: string;
}

export interface VaultItemListResponse {
  items: VaultItemResponse[];
  sync_token: string | null;
}

export interface CreateVaultItemRequest {
  item_type: VaultItemType;
  encrypted_data: string;
  nonce: string;
}

export interface UpdateVaultItemRequest {
  encrypted_data: string;
  nonce: string;
  item_type?: VaultItemType;
}
