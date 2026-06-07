import { describe, expect, it } from "vitest";
import { loginMatchesPageHost } from "../src/domainMatching";

function credentialMatchesSavedLogin(
  savedUrl: string | undefined,
  savedUsername: string | undefined,
  pageUrl: string,
  submittedUsername: string,
): boolean {
  const hostname = new URL(pageUrl).hostname;
  const normalizedSubmitted = submittedUsername.trim().toLowerCase();
  const normalizedSaved = (savedUsername ?? "").trim().toLowerCase();

  if (normalizedSubmitted && normalizedSaved !== normalizedSubmitted) {
    return false;
  }

  return loginMatchesPageHost(savedUrl, hostname);
}

describe("login save duplicate detection", () => {
  it("matches same username on the same hostname", () => {
    expect(
      credentialMatchesSavedLogin(
        "https://github.com/login",
        "alice",
        "https://github.com/session",
        "alice",
      ),
    ).toBe(true);
  });

  it("rejects different usernames on the same hostname", () => {
    expect(
      credentialMatchesSavedLogin(
        "https://github.com/login",
        "alice",
        "https://github.com/session",
        "bob",
      ),
    ).toBe(false);
  });

  it("rejects same username on a different hostname", () => {
    expect(
      credentialMatchesSavedLogin(
        "https://gitlab.com/login",
        "alice",
        "https://github.com/session",
        "alice",
      ),
    ).toBe(false);
  });
});
