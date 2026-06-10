/**
 * DOM helpers for filling login fields in page context (content scripts).
 * Uses native value setter + input/change events so React/Vue pick up updates.
 */

import { VAULTLOCK_DECORATED_FIELD_SELECTOR, ensureVaultlockFieldId } from "./fieldMarkers";
import { isVisibleField } from "./fieldVisibility";

export interface FillLoginFieldsOptions {
  username: string;
  password: string;
  triggerFieldType: "username" | "password";
  associatedFieldId?: string;
  triggerFieldId?: string;
}

export const PASSWORD_FIELD_SELECTOR =
  'input[type="password"], input[autocomplete="new-password"], input[autocomplete="current-password"]';

function isPasswordField(input: HTMLInputElement): boolean {
  if (input.type === "password") {
    return true;
  }

  const autocomplete = (input.autocomplete || "").toLowerCase();
  return autocomplete === "new-password" || autocomplete === "current-password";
}

function isCapturableField(input: HTMLInputElement): boolean {
  if (input.type === "hidden") {
    return false;
  }

  const style = window.getComputedStyle(input);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }

  if (input.disabled || input.readOnly) {
    return input.value.trim().length > 0;
  }

  return isVisibleField(input);
}

function resolveFieldReference(id: string | undefined): HTMLInputElement | null {
  if (!id) {
    return null;
  }

  const byId = document.getElementById(id);
  if (byId instanceof HTMLInputElement) {
    return byId;
  }

  return document.querySelector<HTMLInputElement>(`input[data-vaultlock-field-id="${id}"]`);
}

function decoratedFields(): HTMLInputElement[] {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>(VAULTLOCK_DECORATED_FIELD_SELECTOR),
  );
}

function findPasswordFields(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>(PASSWORD_FIELD_SELECTOR)).filter(
    (field) => isVisibleField(field) && isPasswordField(field),
  );
}

const USERNAME_INPUT_SELECTOR =
  'input[type="text"], input[type="email"], input[type="tel"], input:not([type])';

function usernameCandidatesIn(root: ParentNode): HTMLInputElement[] {
  return Array.from(root.querySelectorAll<HTMLInputElement>(USERNAME_INPUT_SELECTOR)).filter(
    (field) => isVisibleField(field) && field.type !== "password",
  );
}

function pickUsernameField(
  passwordField: HTMLInputElement,
  candidates: HTMLInputElement[],
): HTMLInputElement | null {
  if (candidates.length === 0) {
    return null;
  }

  const beforePassword = candidates.filter(
    (field) => field.compareDocumentPosition(passwordField) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
  if (beforePassword.length > 0) {
    return beforePassword[beforePassword.length - 1];
  }

  return candidates[0];
}

function findAssociatedUsernameField(passwordField: HTMLInputElement): HTMLInputElement | null {
  const linkedId = passwordField.dataset.vaultlockAssociatedUsernameId;
  const linked = resolveFieldReference(linkedId);
  if (linked && isVisibleField(linked)) {
    return linked;
  }

  const form = passwordField.closest("form");
  if (form) {
    const picked = pickUsernameField(passwordField, usernameCandidatesIn(form));
    if (picked) {
      return picked;
    }
  }

  let container: Element | null = passwordField.parentElement;
  while (container && container !== document.body) {
    const picked = pickUsernameField(passwordField, usernameCandidatesIn(container));
    if (picked) {
      return picked;
    }
    container = container.parentElement;
  }

  return pickUsernameField(passwordField, usernameCandidatesIn(document));
}

function findLoginCaptureRoot(anchor: Element): Element {
  let node: Element | null = anchor;
  while (node && node !== document.body) {
    const passwordFields = node.querySelectorAll(PASSWORD_FIELD_SELECTOR);
    if (passwordFields.length > 0) {
      return node;
    }
    node = node.parentElement;
  }

  return document.body;
}

function resolveTargetFields(options: FillLoginFieldsOptions): {
  usernameField: HTMLInputElement | null;
  passwordField: HTMLInputElement | null;
} {
  const passwordFields = findPasswordFields();
  const triggerField = resolveFieldReference(options.triggerFieldId);
  let passwordField: HTMLInputElement | null = null;
  let usernameField: HTMLInputElement | null = null;

  if (options.triggerFieldType === "password") {
    passwordField =
      (triggerField?.type === "password" ? triggerField : null) ??
      passwordFields.find((field) => field.dataset.vaultlockActionControl === "true") ??
      passwordFields[0] ??
      null;

    if (passwordField) {
      usernameField =
        resolveFieldReference(options.associatedFieldId) ??
        findAssociatedUsernameField(passwordField);
    }
  } else {
    usernameField =
      (triggerField && triggerField.type !== "password" ? triggerField : null) ??
      resolveFieldReference(options.associatedFieldId) ??
      decoratedFields().find((field) => field.type !== "password" && isVisibleField(field)) ??
      usernameCandidatesIn(document).find((field) => isVisibleField(field)) ??
      null;

    const linkedPasswordId = usernameField?.dataset.vaultlockAssociatedPasswordId;
    passwordField = resolveFieldReference(linkedPasswordId) ?? passwordFields[0] ?? null;

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

export { ensureVaultlockFieldId };

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
    usernameField.dataset.vaultlockSkipSave = "1";
    filledUsername = true;
  }

  if (passwordField && options.password) {
    setInputValue(passwordField, options.password);
    passwordField.dataset.vaultlockSkipSave = "1";
    filledPassword = true;
  }

  return { filledUsername, filledPassword };
}

export function captureLoginFromPasswordField(passwordField: HTMLInputElement): {
  username: string;
  password: string;
} | null {
  if (passwordField.dataset.vaultlockSkipSave === "1") {
    return null;
  }

  const password = passwordField.value;
  if (!password.trim()) {
    return null;
  }

  const usernameField = findAssociatedUsernameField(passwordField);
  const username =
    usernameField && usernameField.dataset.vaultlockSkipSave !== "1"
      ? usernameField.value.trim()
      : "";

  return { username, password };
}

export function captureLoginNearElement(anchor: Element): {
  username: string;
  password: string;
} | null {
  const root = findLoginCaptureRoot(anchor);
  const passwordFields = Array.from(
    root.querySelectorAll<HTMLInputElement>(PASSWORD_FIELD_SELECTOR),
  ).filter((field) => isCapturableField(field) && isPasswordField(field));

  const passwordField =
    passwordFields.find((field) => field.dataset.vaultlockSkipSave !== "1") ??
    passwordFields[0] ??
    null;

  if (!passwordField) {
    return null;
  }

  return captureLoginFromPasswordField(passwordField);
}

export function captureLoginFromForm(form: HTMLFormElement): {
  username: string;
  password: string;
} | null {
  const passwordFields = Array.from(
    form.querySelectorAll<HTMLInputElement>(PASSWORD_FIELD_SELECTOR),
  ).filter((field) => isCapturableField(field) && isPasswordField(field));

  const passwordField =
    passwordFields.find((field) => field.dataset.vaultlockSkipSave !== "1") ??
    passwordFields[0] ??
    null;

  if (!passwordField) {
    return null;
  }

  return captureLoginFromPasswordField(passwordField);
}
