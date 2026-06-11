import { describe, expect, it } from "vitest";
import { buildFillFieldRefs, ensureVaultlockFieldId } from "./fieldMarkers";

describe("ensureVaultlockFieldId", () => {
  it("reuses native input ids", () => {
    const field = { id: "account_name_text_field", dataset: {} } as HTMLInputElement;
    expect(ensureVaultlockFieldId(field)).toBe("account_name_text_field");
  });

  it("generates a stable data attribute when id is missing", () => {
    const field = { id: "", dataset: {} } as HTMLInputElement;
    const generated = ensureVaultlockFieldId(field);
    expect(generated.startsWith("vl-field-")).toBe(true);
    expect(field.dataset.vaultlockFieldId).toBe(generated);
  });
});

describe("buildFillFieldRefs", () => {
  it("uses the trigger field id for username fills", () => {
    const field = {
      id: "account_name_text_field",
      dataset: {},
    } as HTMLInputElement;

    expect(buildFillFieldRefs(field, "username")).toEqual({
      triggerFieldId: "account_name_text_field",
      associatedFieldId: undefined,
    });
  });

  it("passes the linked username id for password fills", () => {
    const field = {
      id: "password_text_field",
      dataset: { vaultlockAssociatedUsernameId: "account_name_text_field" },
    } as HTMLInputElement;

    expect(buildFillFieldRefs(field, "password")).toEqual({
      triggerFieldId: "password_text_field",
      associatedFieldId: "account_name_text_field",
    });
  });
});
