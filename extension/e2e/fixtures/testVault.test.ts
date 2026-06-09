import { decrypt, fromBase64 } from "@vaultlock/shared/crypto/aes";
import { loginMatchesPageHost } from "@vaultlock/shared/domain-matching";
import { describe, expect, it } from "vitest";
import {
  E2E_TEST_CREDENTIALS,
  E2E_TEST_DEK,
  E2E_TEST_LOGIN_ITEM,
  buildE2eVaultCache,
  buildEncryptedLoginItem,
} from "./testVault";

describe("E2E vault fixtures", () => {
  it("builds decryptable login ciphertext", async () => {
    const cache = await buildE2eVaultCache();
    const item = cache.items[0];

    const plaintext = await decrypt(
      fromBase64(item.nonce),
      fromBase64(item.encrypted_data),
      E2E_TEST_DEK,
    );
    const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as {
      username?: string;
      url?: string;
    };

    expect(parsed.username).toBe(E2E_TEST_CREDENTIALS.email);
    expect(loginMatchesPageHost(parsed.url, "127.0.0.1")).toBe(true);
  });

  it("encrypts distinct items with unique nonces", async () => {
    const first = await buildEncryptedLoginItem(
      { title: "A", username: "a", password: "1", url: "https://127.0.0.1" },
      "item-a",
    );
    const second = await buildEncryptedLoginItem(
      { title: "B", username: "b", password: "2", url: "https://127.0.0.1" },
      "item-b",
    );

    expect(first.nonce).not.toBe(second.nonce);
    expect(first.id).toBe("item-a");
    expect(second.id).toBe("item-b");
    expect(E2E_TEST_LOGIN_ITEM.title).toBe("E2E Test Site");
  });
});
