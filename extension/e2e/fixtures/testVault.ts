import { encrypt, toBase64 } from "@vaultlock/shared/crypto/aes";
import type { LoginItemPlaintext, VaultItemResponse } from "@vaultlock/shared/types";

/** Fixed DEK for E2E — never use outside tests. */
export const E2E_TEST_DEK = new Uint8Array(32).fill(0x42);

export const E2E_TEST_CREDENTIALS = {
  email: "e2e-user@example.com",
  password: "E2E-Test-Password-42!",
} as const;

export const E2E_TEST_LOGIN_ITEM = {
  id: "e2e-login-127-0-0-1",
  title: "E2E Test Site",
  url: "https://127.0.0.1/",
} as const;

export const E2E_RELATED_DOMAIN_LOGIN_ITEM = {
  id: "e2e-login-related-domain",
  title: "E2E Related Domain Login",
  url: "https://accounts.example.com/",
  relatedDomains: ["127.0.0.1"],
} as const;

export async function buildEncryptedLoginItem(
  plaintext: LoginItemPlaintext,
  itemId: string,
  dek: Uint8Array = E2E_TEST_DEK,
): Promise<VaultItemResponse> {
  const payload = new TextEncoder().encode(JSON.stringify(plaintext));
  const { nonce, ciphertext } = await encrypt(payload, dek);
  const timestamp = "2026-06-09T00:00:00.000Z";

  return {
    id: itemId,
    item_type: "login",
    encrypted_data: toBase64(ciphertext),
    nonce: toBase64(nonce),
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export async function buildE2eVaultCache(dek: Uint8Array = E2E_TEST_DEK) {
  const item = await buildEncryptedLoginItem(
    {
      title: E2E_TEST_LOGIN_ITEM.title,
      url: E2E_TEST_LOGIN_ITEM.url,
      username: E2E_TEST_CREDENTIALS.email,
      password: E2E_TEST_CREDENTIALS.password,
    },
    E2E_TEST_LOGIN_ITEM.id,
    dek,
  );

  return {
    items: [item],
    syncToken: null,
    updatedAt: Date.now(),
  };
}

export async function buildE2eRelatedDomainVaultCache(dek: Uint8Array = E2E_TEST_DEK) {
  const item = await buildEncryptedLoginItem(
    {
      title: E2E_RELATED_DOMAIN_LOGIN_ITEM.title,
      url: E2E_RELATED_DOMAIN_LOGIN_ITEM.url,
      username: E2E_TEST_CREDENTIALS.email,
      password: E2E_TEST_CREDENTIALS.password,
      relatedDomains: [...E2E_RELATED_DOMAIN_LOGIN_ITEM.relatedDomains],
    },
    E2E_RELATED_DOMAIN_LOGIN_ITEM.id,
    dek,
  );

  return {
    items: [item],
    syncToken: null,
    updatedAt: Date.now(),
  };
}
