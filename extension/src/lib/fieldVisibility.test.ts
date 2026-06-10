import { describe, expect, it } from "vitest";
import {
  isStackedPasswordStepInactive,
  scoreUsernameFieldCandidate,
  selectPrimaryUsernameField,
} from "./fieldVisibility";

function mockInput(partial: {
  type?: string;
  autocomplete?: string;
  placeholder?: string;
  name?: string;
  id?: string;
  area?: number;
  tabIndex?: number;
}): HTMLInputElement {
  const area = partial.area ?? 4_000;
  const width = Math.sqrt(area);
  const height = width;

  return {
    type: partial.type ?? "text",
    autocomplete: partial.autocomplete ?? "",
    placeholder: partial.placeholder ?? "",
    name: partial.name ?? "",
    id: partial.id ?? "",
    tabIndex: partial.tabIndex ?? 0,
    getAttribute: (name: string) => {
      if (name === "aria-label") {
        return "";
      }
      return null;
    },
    getBoundingClientRect: () =>
      ({
        width,
        height,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
      }) as DOMRect,
  } as HTMLInputElement;
}

describe("scoreUsernameFieldCandidate", () => {
  it("prefers email autocomplete and larger visible fields", () => {
    const generic = mockInput({ area: 5_000 });
    const email = mockInput({
      type: "email",
      autocomplete: "username",
      placeholder: "Email or Phone Number",
      area: 4_000,
    });

    expect(scoreUsernameFieldCandidate(email)).toBeGreaterThan(
      scoreUsernameFieldCandidate(generic),
    );
  });

  it("deprioritizes fields removed from tab order", () => {
    const normal = mockInput({ placeholder: "Email", area: 3_000 });
    const honeypot = mockInput({ name: "email", area: 3_000, tabIndex: -1 });

    expect(scoreUsernameFieldCandidate(normal)).toBeGreaterThan(
      scoreUsernameFieldCandidate(honeypot),
    );
  });
});

describe("selectPrimaryUsernameField", () => {
  it("returns the strongest username candidate", () => {
    const honeypot = mockInput({ name: "secondary-email", area: 3_000, tabIndex: -1 });
    const primary = mockInput({
      type: "email",
      autocomplete: "username",
      placeholder: "Email or Phone Number",
      area: 4_000,
    });

    expect(selectPrimaryUsernameField([honeypot, primary])).toBe(primary);
  });
});

describe("isStackedPasswordStepInactive", () => {
  it("treats stacked password fields as inactive while username is empty", () => {
    expect(
      isStackedPasswordStepInactive(
        { top: 60, bottom: 104 },
        [{ top: 0, bottom: 44, value: "" }],
        false,
      ),
    ).toBe(true);
  });

  it("activates password step once username has a value", () => {
    expect(
      isStackedPasswordStepInactive(
        { top: 60, bottom: 104 },
        [{ top: 0, bottom: 44, value: "user@example.com" }],
        false,
      ),
    ).toBe(false);
  });
});
