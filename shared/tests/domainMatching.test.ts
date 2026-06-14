import { describe, expect, it } from "vitest";
import {
  compareLoginMatchScores,
  extractLoginHostname,
  formatLoginMatchHint,
  loginMatchesPageHost,
  normalizeHostname,
  scoreLoginForPageHost,
  sortLoginUrlsForPageHost,
} from "../src/domainMatching";

describe("normalizeHostname", () => {
  it("lowercases and trims hostnames", () => {
    expect(normalizeHostname("  GitHub.COM. ")).toBe("github.com");
  });
});

describe("extractLoginHostname", () => {
  it("parses URLs with or without a scheme", () => {
    expect(extractLoginHostname("https://login.example.com/path")).toBe("login.example.com");
    expect(extractLoginHostname("accounts.example.com")).toBe("accounts.example.com");
  });

  it("returns null for empty values", () => {
    expect(extractLoginHostname(undefined)).toBeNull();
    expect(extractLoginHostname("   ")).toBeNull();
  });
});

describe("scoreLoginForPageHost", () => {
  it("scores exact hostname matches highest", () => {
    const result = scoreLoginForPageHost("https://github.com/login", "github.com");
    expect(result).toEqual({ matches: true, kind: "exact", score: 0 });
  });

  it("matches subdomains in both directions", () => {
    expect(scoreLoginForPageHost("https://www.github.com", "github.com")).toMatchObject({
      matches: true,
      kind: "subdomain",
    });
    expect(scoreLoginForPageHost("https://github.com", "www.github.com")).toMatchObject({
      matches: true,
      kind: "subdomain",
    });
  });

  it("ranks closer subdomain matches ahead of distant ones", () => {
    const close = scoreLoginForPageHost("https://login.github.com", "github.com");
    const far = scoreLoginForPageHost("https://a.b.github.com", "github.com");
    expect(close.score).toBeLessThan(far.score);
  });

  it("treats logins without a URL as low-priority matches", () => {
    expect(scoreLoginForPageHost(undefined, "github.com")).toEqual({
      matches: true,
      kind: "no_url",
      score: 200,
    });
  });

  it("rejects unrelated hosts", () => {
    expect(scoreLoginForPageHost("https://gitlab.com", "github.com")).toEqual({
      matches: false,
      kind: null,
      score: Number.POSITIVE_INFINITY,
    });
  });

  it("supports user-managed related domains", () => {
    const result = scoreLoginForPageHost("https://accounts.google.com", "mail.google.com", {
      relatedDomains: ["google.com"],
    });
    expect(result).toMatchObject({ matches: true, kind: "related" });
  });

  it("supports wildcard related domain patterns", () => {
    const result = scoreLoginForPageHost("https://login.example.org", "app.example.com", {
      relatedDomains: ["*.example.com"],
    });
    expect(result).toMatchObject({ matches: true, kind: "related" });
  });

  it("does not match apex hostnames against wildcard patterns", () => {
    expect(
      scoreLoginForPageHost("https://login.example.org", "example.com", {
        relatedDomains: ["*.example.com"],
      }).matches,
    ).toBe(false);
  });

  it("falls back to substring matching for malformed URLs", () => {
    expect(loginMatchesPageHost("not-a-valid-url github.com fragment", "github.com")).toBe(true);
  });
});

describe("formatLoginMatchHint", () => {
  it("labels related and subdomain matches for inline UI", () => {
    expect(formatLoginMatchHint("related", "user@example.com")).toBe(
      "user@example.com · Related site",
    );
    expect(formatLoginMatchHint("subdomain", "user@example.com")).toBe(
      "user@example.com · Subdomain",
    );
  });

  it("keeps exact matches as username-only hints", () => {
    expect(formatLoginMatchHint("exact", "user@example.com")).toBe("user@example.com");
    expect(formatLoginMatchHint(null, "")).toBe("No username saved");
  });
});

describe("compareLoginMatchScores", () => {
  it("orders exact matches before subdomain matches", () => {
    const exact = scoreLoginForPageHost("https://github.com", "github.com");
    const subdomain = scoreLoginForPageHost("https://www.github.com", "github.com");
    expect(compareLoginMatchScores(exact, subdomain)).toBeLessThan(0);
  });
});

describe("sortLoginUrlsForPageHost", () => {
  it("returns indices sorted by match strength", () => {
    const entries = [
      { url: "https://gitlab.com" },
      { url: "https://www.github.com" },
      { url: "https://github.com" },
      { url: undefined },
    ];

    expect(sortLoginUrlsForPageHost(entries, "github.com")).toEqual([2, 1, 3, 0]);
  });
});
