import { describe, expect, it } from "vitest";
import {
  isDefinitiveLoginContext,
  isLikelyLoginContext,
  isLikelySignupContext,
  scoreSignupContext,
} from "../src/signupFormDetection";

describe("signup form detection", () => {
  it("detects Rakuten signup", () => {
    expect(
      isLikelySignupContext({
        urlText: "/auth/v2/signup?flow=default",
        submitLabel: "Join Now",
        containerText: "Join Now",
      }),
    ).toBe(true);
  });

  it("rejects Rakuten login even with Join Now marketing link on page", () => {
    expect(
      isLikelySignupContext({
        urlText: "/auth/v2/login?flow=default",
        submitLabel: "Sign In",
        containerText: "Sign In",
        hasForgotPasswordLink: true,
      }),
    ).toBe(false);
    expect(
      isDefinitiveLoginContext({
        urlText: "/auth/v2/login?flow=default",
        submitLabel: "Sign In",
      }),
    ).toBe(true);
  });

  it("rejects login forms with sign-in URL and button", () => {
    const score = scoreSignupContext({
      urlText: "/auth/v2/signin",
      submitLabel: "Sign In",
      passwordAutocomplete: "current-password",
      hasForgotPasswordLink: true,
    });
    expect(score.login).toBeGreaterThan(score.signup);
    expect(
      isLikelyLoginContext({
        urlText: "/auth/v2/signin",
        submitLabel: "Sign In",
        passwordAutocomplete: "current-password",
        hasForgotPasswordLink: true,
      }),
    ).toBe(true);
  });

  it("detects signup from new-password autocomplete", () => {
    expect(
      isLikelySignupContext({
        passwordAutocomplete: "new-password",
        submitLabel: "Create account",
      }),
    ).toBe(true);
  });

  it("rejects ambiguous forms without signup signals", () => {
    expect(
      isLikelySignupContext({
        submitLabel: "Submit",
        urlText: "/account",
      }),
    ).toBe(false);
  });

  it("does not treat marketing Join today copy as signup", () => {
    expect(
      isLikelySignupContext({
        containerText: "Join today and get over 10% Cash Back",
        urlText: "/",
      }),
    ).toBe(false);
  });

  it("detects signup when confirm-password field is present", () => {
    expect(
      isLikelySignupContext({
        hasConfirmPasswordField: true,
        submitLabel: "Sign up",
        containerText: "Create your account",
      }),
    ).toBe(true);
  });
});
