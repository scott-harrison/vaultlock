import { describe, expect, it } from "vitest";

const SUBMIT_LABEL_PATTERN =
  /\b(sign[\s-]?up|register|create(?:\s+(?:an?\s+)?account)?|log[\s-]?in|sign[\s-]?in|continue|next|submit|join(?:\s+now)?|get[\s-]?started)\b/i;
const EXCLUDE_LABEL_PATTERN =
  /\b(cancel|back|skip|close|not\s+now|maybe\s+later|forgot|reset|facebook|google|apple|social|connect)\b/i;

function isSubmitLikeLabel(label: string): boolean {
  if (EXCLUDE_LABEL_PATTERN.test(label)) {
    return false;
  }
  return SUBMIT_LABEL_PATTERN.test(label);
}

describe("save login submit heuristics", () => {
  it("matches common signup and login button labels", () => {
    expect(isSubmitLikeLabel("Sign up")).toBe(true);
    expect(isSubmitLikeLabel("Create account")).toBe(true);
    expect(isSubmitLikeLabel("Continue")).toBe(true);
    expect(isSubmitLikeLabel("Log in")).toBe(true);
    expect(isSubmitLikeLabel("Join Now")).toBe(true);
  });

  it("rejects dismissive controls", () => {
    expect(isSubmitLikeLabel("Cancel")).toBe(false);
    expect(isSubmitLikeLabel("Not now")).toBe(false);
    expect(isSubmitLikeLabel("Forgot password?")).toBe(false);
    expect(isSubmitLikeLabel("Continue with Facebook")).toBe(false);
  });
});
