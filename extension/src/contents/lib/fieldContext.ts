export type FieldKind = "username" | "password";

export interface FieldContext {
  fieldType: FieldKind;
  isNewPassword: boolean;
}

export function getFieldContext(field: HTMLInputElement, fieldType: FieldKind): FieldContext {
  if (fieldType !== "password") {
    return { fieldType, isNewPassword: false };
  }

  return { fieldType, isNewPassword: isLikelyNewPasswordField(field) };
}

function isLikelyNewPasswordField(field: HTMLInputElement): boolean {
  const autocomplete = (field.autocomplete || "").toLowerCase();
  if (autocomplete === "new-password") {
    return true;
  }
  if (autocomplete === "current-password") {
    return false;
  }

  const hints =
    `${field.name} ${field.id} ${field.placeholder} ${field.getAttribute("aria-label") ?? ""}`.toLowerCase();
  if (
    /(?:new|confirm|signup|sign-up|register|create|choose).*(?:pass|pwd)|(?:pass|pwd).*(?:new|confirm)/.test(
      hints,
    )
  ) {
    return true;
  }

  const form = field.closest("form");
  if (form) {
    const passwordFields = Array.from(
      form.querySelectorAll<HTMLInputElement>('input[type="password"]'),
    ).filter((input) => input.offsetParent !== null);

    if (passwordFields.length >= 2) {
      return true;
    }
  }

  return false;
}
