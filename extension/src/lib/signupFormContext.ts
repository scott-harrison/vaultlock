import {
  type SignupContextSignals,
  isLikelyLoginContext,
  isLikelySignupContext,
} from "@vaultlock/shared/signup-form-detection";
import { controlLabel } from "./saveLoginHeuristics";

function isVisibleInput(input: HTMLInputElement): boolean {
  return input.type !== "hidden" && input.offsetWidth > 0 && input.offsetHeight > 0;
}

function findFormRoot(anchor: Element): HTMLFormElement | null {
  if (anchor instanceof HTMLFormElement) {
    return anchor;
  }
  return anchor.closest("form");
}

function findPasswordField(form: HTMLFormElement | null, anchor: Element): HTMLInputElement | null {
  if (anchor instanceof HTMLInputElement) {
    const autocomplete = (anchor.autocomplete || "").toLowerCase();
    if (
      anchor.type === "password" ||
      autocomplete === "new-password" ||
      autocomplete === "current-password"
    ) {
      return anchor;
    }
  }

  const scope = form ?? anchor;
  const fields = Array.from(
    scope.querySelectorAll<HTMLInputElement>(
      'input[type="password"], input[autocomplete="new-password"], input[autocomplete="current-password"]',
    ),
  ).filter(isVisibleInput);

  return fields[0] ?? null;
}

function hasConfirmPasswordField(form: HTMLFormElement | null): boolean {
  if (!form) {
    return false;
  }

  const passwordFields = Array.from(
    form.querySelectorAll<HTMLInputElement>('input[type="password"]'),
  ).filter(isVisibleInput);

  if (passwordFields.length >= 2) {
    return true;
  }

  return Array.from(form.querySelectorAll<HTMLInputElement>("input")).some((input) => {
    if (!isVisibleInput(input)) {
      return false;
    }

    const hints =
      `${input.name} ${input.id} ${input.placeholder} ${input.getAttribute("aria-label") ?? ""}`.toLowerCase();
    return /confirm|repeat|retype|verify/.test(hints) && /pass|pwd/.test(hints);
  });
}

function hasForgotPasswordLink(form: HTMLFormElement | null): boolean {
  if (!form) {
    return false;
  }

  const candidates = Array.from(form.querySelectorAll<HTMLElement>("a, button, [role='link']"));
  return candidates.some((element) => {
    const text =
      `${element.textContent ?? ""} ${element.getAttribute("aria-label") ?? ""} ${element.getAttribute("href") ?? ""}`.toLowerCase();
    return /forgot|reset\s+password|recover\s+password|sign\s+in\s+without\s+a\s+password/.test(
      text,
    );
  });
}

function formContainerText(form: HTMLFormElement | null): string {
  if (!form) {
    return "";
  }

  const headingText = Array.from(
    form.querySelectorAll("h1, h2, h3, legend, [role='heading'], label"),
  )
    .map((node) => node.textContent ?? "")
    .join(" ");

  return headingText.slice(0, 400);
}

function passwordFieldHints(field: HTMLInputElement | null): string {
  if (!field) {
    return "";
  }

  return `${field.name} ${field.id} ${field.placeholder} ${field.getAttribute("aria-label") ?? ""}`;
}

export function collectSignupSignals(
  anchor: Element,
  submitControl?: Element,
): SignupContextSignals {
  const form = findFormRoot(anchor);
  const passwordField = findPasswordField(form, anchor);
  const formAction = form?.getAttribute("action") ?? "";

  return {
    urlText: `${window.location.pathname} ${window.location.search} ${window.location.hash} ${formAction}`,
    submitLabel: submitControl ? controlLabel(submitControl) : "",
    passwordAutocomplete: passwordField?.autocomplete,
    containerText: formContainerText(form),
    hasConfirmPasswordField: hasConfirmPasswordField(form),
    hasForgotPasswordLink: hasForgotPasswordLink(form),
    passwordFieldHints: passwordFieldHints(passwordField),
  };
}

export function signalsFromPageUrl(pageUrl: string): SignupContextSignals {
  return { urlText: pageUrl };
}

export function isLikelySignupFormContext(anchor: Element, submitControl?: Element): boolean {
  return isLikelySignupContext(collectSignupSignals(anchor, submitControl));
}

export function isLikelyLoginFormContext(anchor: Element, submitControl?: Element): boolean {
  return isLikelyLoginContext(collectSignupSignals(anchor, submitControl));
}
