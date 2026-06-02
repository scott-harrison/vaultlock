import { webcrypto } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import {
  decrypt,
  decryptJsonPayloadBase64,
  deriveMasterKey,
  emailSalt,
  encrypt,
  encryptJsonPayloadBase64,
  fromBase64,
  hashMasterPasswordAuth,
  parseWrappedDekJson,
  toBase64,
  unwrapDek,
  verifyMasterPasswordAuth,
  wrapDek,
} from "../src/crypto";

beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, "crypto", {
      value: webcrypto,
      configurable: true,
    });
  }
});

describe("aes_gcm", () => {
  it("encrypts and decrypts roundtrip", async () => {
    const key = new Uint8Array(32).fill(0x42);
    const plaintext = new TextEncoder().encode("Hello, Vaultlock!");

    const { nonce, ciphertext } = await encrypt(plaintext, key);
    const decrypted = await decrypt(nonce, ciphertext, key);

    expect(new TextDecoder().decode(decrypted)).toBe("Hello, Vaultlock!");
  });

  it("wraps and unwraps DEK", async () => {
    const masterKey = new Uint8Array(32).fill(0x11);
    const dek = new Uint8Array(32).fill(0x22);

    const { nonce, ciphertext } = await wrapDek(dek, masterKey);
    const unwrapped = await unwrapDek(nonce, ciphertext, masterKey);

    expect(unwrapped).toEqual(dek);
  });

  it("rejects wrong key", async () => {
    const key1 = new Uint8Array(32).fill(0x01);
    const key2 = new Uint8Array(32).fill(0x02);
    const plaintext = new TextEncoder().encode("secret");

    const { nonce, ciphertext } = await encrypt(plaintext, key1);
    await expect(decrypt(nonce, ciphertext, key2)).rejects.toThrow();
  });

  it("roundtrips base64 helpers", () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });
});

describe("vault payload encryption", () => {
  it("encrypts and decrypts JSON payloads as base64 blobs", async () => {
    const dek = new Uint8Array(32).fill(0x33);
    const payload = { username: "alice", password: "hunter2" };

    const blob = await encryptJsonPayloadBase64(payload, dek);
    const decrypted = await decryptJsonPayloadBase64<typeof payload>(
      blob.encrypted_data,
      blob.nonce,
      dek,
    );

    expect(decrypted).toEqual(payload);
  });
});

describe("argon2", () => {
  it("produces argon2id PHC hash for auth", async () => {
    const hash = await hashMasterPasswordAuth("correct-horse-battery-staple");
    expect(hash.startsWith("$argon2id$")).toBe(true);
  });

  it("verifies master password against PHC hash", async () => {
    const password = "correct-horse-battery-staple";
    const hash = await hashMasterPasswordAuth(password);
    await expect(verifyMasterPasswordAuth(password, hash)).resolves.toBe(true);
    await expect(verifyMasterPasswordAuth("wrong-password", hash)).resolves.toBe(false);
  });

  it("derives deterministic master key from email + password", async () => {
    const first = await deriveMasterKey("password123", "User@Example.com");
    const second = await deriveMasterKey("password123", "user@example.com");
    const different = await deriveMasterKey("other", "user@example.com");

    expect(first).toHaveLength(32);
    expect(second).toEqual(first);
    expect(different).not.toEqual(first);
  });

  it("normalizes email salt to 16 bytes", () => {
    expect(emailSalt("a@b.co")).toHaveLength(16);
    expect(emailSalt("user@example.com")).toHaveLength(16);
  });
});

describe("parseWrappedDekJson", () => {
  it("parses flat nonce/ciphertext", () => {
    expect(parseWrappedDekJson({ nonce: "abc", ciphertext: "def" })).toEqual({
      nonce: "abc",
      ciphertext: "def",
    });
  });

  it("parses nested wrapped_dek", () => {
    expect(
      parseWrappedDekJson({
        wrapped_dek: { nonce: "n", ciphertext: "c" },
      }),
    ).toEqual({ nonce: "n", ciphertext: "c" });
  });

  it("returns null for invalid shapes", () => {
    expect(parseWrappedDekJson(null)).toBeNull();
    expect(parseWrappedDekJson({})).toBeNull();
    expect(parseWrappedDekJson({ nonce: 1, ciphertext: 2 })).toBeNull();
  });
});
