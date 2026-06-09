import { describe, expect, it } from "vitest";
import { evaluateSaveLoginDecision, loginCredentialMatchesPage } from "../src/loginSaveMatch";

describe("loginCredentialMatchesPage", () => {
  it("matches same username on the same hostname", () => {
    expect(
      loginCredentialMatchesPage(
        "https://github.com/login",
        "alice",
        "https://github.com/session",
        "alice",
      ),
    ).toBe(true);
  });

  it("rejects different usernames on the same hostname", () => {
    expect(
      loginCredentialMatchesPage(
        "https://github.com/login",
        "alice",
        "https://github.com/session",
        "bob",
      ),
    ).toBe(false);
  });

  it("rejects same username on a different hostname", () => {
    expect(
      loginCredentialMatchesPage(
        "https://gitlab.com/login",
        "alice",
        "https://github.com/session",
        "alice",
      ),
    ).toBe(false);
  });

  it("matches hostname when the saved username is empty", () => {
    expect(
      loginCredentialMatchesPage(
        "https://www.rakuten.com/auth/v2/signup",
        "",
        "https://www.rakuten.com/auth/v2/signin",
        "test106@yopmail.com",
      ),
    ).toBe(true);
  });
});

describe("evaluateSaveLoginDecision", () => {
  const items = [
    {
      id: "item-1",
      plaintext: {
        title: "GitHub",
        url: "https://github.com/login",
        username: "alice",
        password: "old-secret",
      },
    },
  ];

  it("returns save when no matching login exists", () => {
    expect(
      evaluateSaveLoginDecision(
        {
          username: "bob",
          password: "new-secret",
          pageUrl: "https://github.com/signup",
        },
        items,
      ),
    ).toEqual({ kind: "save" });
  });

  it("returns skip when the password matches the saved login", () => {
    expect(
      evaluateSaveLoginDecision(
        {
          username: "alice",
          password: "old-secret",
          pageUrl: "https://github.com/session",
        },
        items,
      ),
    ).toEqual({ kind: "skip" });
  });

  it("returns update when the password differs from the saved login", () => {
    expect(
      evaluateSaveLoginDecision(
        {
          username: "alice",
          password: "new-secret",
          pageUrl: "https://github.com/session",
        },
        items,
      ),
    ).toEqual({ kind: "update", itemId: "item-1" });
  });
});
