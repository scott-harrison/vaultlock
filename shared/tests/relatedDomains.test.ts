import { describe, expect, it } from "vitest";
import {
  formatRelatedDomainsForInput,
  normalizeRelatedDomainList,
  parseRelatedDomainsInput,
} from "../src/relatedDomains";

describe("normalizeRelatedDomainList", () => {
  it("normalizes hostnames and deduplicates entries", () => {
    expect(
      normalizeRelatedDomainList([" GitHub.COM ", "github.com", "accounts.GitHub.com"]),
    ).toEqual(["github.com", "accounts.github.com"]);
  });

  it("accepts wildcard patterns", () => {
    expect(normalizeRelatedDomainList(["*.example.com"])).toEqual(["*.example.com"]);
  });

  it("rejects invalid wildcard patterns", () => {
    expect(normalizeRelatedDomainList(["*.com", "*.", "  "])).toBeUndefined();
  });
});

describe("parseRelatedDomainsInput", () => {
  it("parses comma- and whitespace-separated values", () => {
    expect(parseRelatedDomainsInput("google.com, mail.google.com\naccounts.google.com")).toEqual([
      "google.com",
      "mail.google.com",
      "accounts.google.com",
    ]);
  });

  it("returns undefined for empty input", () => {
    expect(parseRelatedDomainsInput("   ")).toBeUndefined();
  });
});

describe("formatRelatedDomainsForInput", () => {
  it("joins domains for textarea display", () => {
    expect(formatRelatedDomainsForInput(["github.com", "gitlab.com"])).toBe(
      "github.com, gitlab.com",
    );
  });
});
