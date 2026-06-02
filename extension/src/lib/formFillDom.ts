/**
 * DOM helpers for filling login fields in page context (content scripts).
 * Uses native value setter + input/change events so React/Vue pick up updates.
 */

export interface FillLoginFieldsOptions {
  username: string;
  password: string;
  triggerFieldType: "username" | "password";
  associatedFieldId?: string;
}

function isVisibleField(input: HTMLInputElement): boolean {
  const style = window.getComputedStyle(input);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    input.offsetWidth > 20 &&
    input.offsetHeight > 10 &&
    !input.disabled &&
    !input.readOnly
  );
}

function fieldById(id: string | undefined): HTMLInputElement | null {
  if (!id) return null;
  const el = document.getElementById(id);
  return el instanceof HTMLInputElement ? el : null;
}

function findPasswordFields(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[type="password"]')).filter(
    isVisibleField,
  );
}

function findAssociatedUsernameField(passwordField: HTMLInputElement): HTMLInputElement | null {
  const linkedId = passwordField.dataset.vaultlockAssociatedUsernameId;
  const linked = fieldById(linkedId);
  if (linked && isVisibleField(linked)) return linked;

  const form = passwordField.closest("form");
  if (form) {
    const usernameCandidates = Array.from(
      form.querySelectorAll<HTMLInputElement>(
        'input[type="text"], input[type="email"], input:not([type])',
      ),
    ).filter(isVisibleField);

    const beforePassword = usernameCandidates.filter(
      (f) => f.compareDocumentPosition(passwordField) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
    if (beforePassword.length > 0) return beforePassword[beforePassword.length - 1];
    if (usernameCandidates.length > 0) return usernameCandidates[0];
  }

  return null;
}

function resolveTargetFields(options: FillLoginFieldsOptions): {
  usernameField: HTMLInputElement | null;
  passwordField: HTMLInputElement | null;
} {
  const passwordFields = findPasswordFields();
  let passwordField: HTMLInputElement | null = null;
  let usernameField: HTMLInputElement | null = null;

  if (options.triggerFieldType === "password") {
    passwordField =
      fieldById(options.associatedFieldId) ??
      passwordFields.find((f) => f.dataset.vaultlockIndicator) ??
      passwordFields[0] ??
      null;
    if (passwordField) {
      usernameField = findAssociatedUsernameField(passwordField);
    }
  } else {
    usernameField =
      fieldById(options.associatedFieldId) ??
      Array.from(
        document.querySelectorAll<HTMLInputElement>("input[data-vaultlock-indicator]"),
      ).find((f) => f.type !== "password" && isVisibleField(f)) ??
      null;

    const linkedPasswordId = usernameField?.dataset.vaultlockAssociatedPasswordId;
    passwordField = fieldById(linkedPasswordId) ?? passwordFields[0] ?? null;
    if (!usernameField && passwordField) {
      usernameField = findAssociatedUsernameField(passwordField);
    }
  }

  if (!passwordField && passwordFields.length > 0) {
    passwordField = passwordFields[0];
    usernameField = usernameField ?? findAssociatedUsernameField(passwordField);
  }

  return { usernameField, passwordField };
}

/** Set value in a way that triggers framework listeners (React 16+, etc.). */
export function setInputValue(element: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

export function fillLoginFields(options: FillLoginFieldsOptions): {
  filledUsername: boolean;
  filledPassword: boolean;
} {
  const { usernameField, passwordField } = resolveTargetFields(options);
  let filledUsername = false;
  let filledPassword = false;

  if (usernameField && options.username) {
    setInputValue(usernameField, options.username);
    filledUsername = true;
  }

  if (passwordField && options.password) {
    setInputValue(passwordField, options.password);
    filledPassword = true;
  }

  return { filledUsername, filledPassword };
}
