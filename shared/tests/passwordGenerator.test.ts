import { webcrypto } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import {
  DEFAULT_PASSWORD_GENERATOR_OPTIONS,
  MAX_GENERATED_LENGTH,
  MIN_GENERATED_LENGTH,
  generatePassword,
} from "../src/passwordGenerator";

beforeAll(() => {
  if (!globalThis.crypto?.getRandomValues) {
    Object.defineProperty(globalThis, "crypto", {
      value: webcrypto,
      configurable: true,
    });
  }
});

describe("generatePassword", () => {
  it("respects length bounds", () => {
    const short = generatePassword({ ...DEFAULT_PASSWORD_GENERATOR_OPTIONS, length: 4 });
    const long = generatePassword({ ...DEFAULT_PASSWORD_GENERATOR_OPTIONS, length: 99 });

    expect(short.length).toBe(MIN_GENERATED_LENGTH);
    expect(long.length).toBe(MAX_GENERATED_LENGTH);
  });

  it("includes at least one character from each enabled charset", () => {
    const password = generatePassword({
      length: 20,
      uppercase: true,
      numbers: true,
      symbols: true,
    });

    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[0-9]/);
    expect(password).toMatch(/[!@#$%^&*()\-_=+[\]{}|;:,.<>?]/);
  });

  it("lowercase-only mode never emits uppercase, digits, or symbols", () => {
    const password = generatePassword({
      length: 12,
      uppercase: false,
      numbers: false,
      symbols: false,
    });

    expect(password).toMatch(/^[a-z]+$/);
    expect(password.length).toBe(12);
  });

  it("produces different values across calls", () => {
    const a = generatePassword(DEFAULT_PASSWORD_GENERATOR_OPTIONS);
    const b = generatePassword(DEFAULT_PASSWORD_GENERATOR_OPTIONS);
    expect(a).not.toBe(b);
  });
});
