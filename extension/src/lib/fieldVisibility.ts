export function hasHiddenAncestor(element: Element): boolean {
  let current: Element | null = element;

  while (current && current !== document.documentElement) {
    if (current instanceof HTMLElement) {
      if (current.hidden) {
        return true;
      }

      if (current.getAttribute("aria-hidden") === "true") {
        return true;
      }

      if (current.hasAttribute("inert")) {
        return true;
      }

      const style = window.getComputedStyle(current);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number.parseFloat(style.opacity) < 0.01
      ) {
        return true;
      }
    }

    current = current.parentElement;
  }

  return false;
}

export function hasPointerEventsDisabled(element: Element): boolean {
  let current: Element | null = element;

  while (current && current instanceof HTMLElement) {
    if (window.getComputedStyle(current).pointerEvents === "none") {
      return true;
    }

    current = current.parentElement;
  }

  return false;
}

export function isFieldInteractableAtCenter(field: HTMLInputElement): boolean {
  const rect = field.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) {
    return false;
  }

  const x = Math.min(Math.max(rect.left + rect.width / 2, 0), window.innerWidth - 1);
  const y = Math.min(Math.max(rect.top + rect.height / 2, 0), window.innerHeight - 1);
  const target = document.elementFromPoint(x, y);

  if (!target) {
    return false;
  }

  return target === field || field.contains(target) || target.contains(field);
}

export function isFieldFocusable(input: HTMLInputElement): boolean {
  if (input.disabled || input.readOnly || input.type === "hidden") {
    return false;
  }

  if (input.tabIndex < 0) {
    return false;
  }

  if (hasHiddenAncestor(input)) {
    return false;
  }

  return true;
}

export function isVisibleField(input: HTMLInputElement): boolean {
  if (!input.isConnected || input.type === "hidden") {
    return false;
  }

  if (input.disabled || input.readOnly) {
    return false;
  }

  if (input.getAttribute("aria-hidden") === "true") {
    return false;
  }

  if (hasHiddenAncestor(input)) {
    return false;
  }

  if ("checkVisibility" in input) {
    try {
      if (
        !(input as HTMLElement).checkVisibility({
          checkOpacity: true,
          checkVisibilityCSS: true,
        })
      ) {
        return false;
      }
    } catch {
      // Fall through to manual checks when the API is unavailable.
    }
  }

  const style = window.getComputedStyle(input);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    Number.parseFloat(style.opacity) < 0.01
  ) {
    return false;
  }

  if (input.getClientRects().length === 0) {
    return false;
  }

  const rect = input.getBoundingClientRect();
  if (rect.width < 20 || rect.height < 10) {
    return false;
  }

  if (
    rect.bottom <= 0 ||
    rect.top >= window.innerHeight ||
    rect.right <= 0 ||
    rect.left >= window.innerWidth
  ) {
    return false;
  }

  return true;
}

export interface UsernameStepSnapshot {
  top: number;
  bottom: number;
  value: string;
}

export function isStackedPasswordStepInactive(
  passwordRect: Pick<DOMRect, "top" | "bottom">,
  visibleUsernames: readonly UsernameStepSnapshot[],
  passwordFocused: boolean,
): boolean {
  if (visibleUsernames.length === 0) {
    return false;
  }

  const stackedBelowUsername = visibleUsernames.some(
    (username) => passwordRect.top >= username.bottom - 24,
  );

  if (!stackedBelowUsername) {
    return false;
  }

  if (passwordFocused) {
    return false;
  }

  return visibleUsernames.some((username) => !username.value.trim());
}

export function isPasswordFieldOnActiveStep(
  passwordField: HTMLInputElement,
  usernameFields: readonly HTMLInputElement[],
): boolean {
  if (!isVisibleField(passwordField) || !isFieldFocusable(passwordField)) {
    return false;
  }

  const form = passwordField.closest("form");
  const visibleUsernames = usernameFields.filter(
    (field) => isVisibleField(field) && (!form || form.contains(field)),
  );

  if (visibleUsernames.length === 0) {
    return true;
  }

  const passwordRect = passwordField.getBoundingClientRect();
  const inactive = isStackedPasswordStepInactive(
    passwordRect,
    visibleUsernames.map((field) => {
      const rect = field.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        value: field.value ?? "",
      };
    }),
    document.activeElement === passwordField,
  );

  if (!inactive) {
    return true;
  }

  return !hasPointerEventsDisabled(passwordField) && isFieldInteractableAtCenter(passwordField);
}

export function fieldVisualArea(input: HTMLInputElement): number {
  const rect = input.getBoundingClientRect();
  return Math.max(0, rect.width) * Math.max(0, rect.height);
}

export function scoreUsernameFieldCandidate(input: HTMLInputElement): number {
  let score = fieldVisualArea(input);

  const autocomplete = (input.autocomplete || "").toLowerCase();
  if (autocomplete.includes("username") || autocomplete.includes("email")) {
    score += 10_000;
  }

  if (input.type === "email") {
    score += 5_000;
  }

  const hints =
    `${input.name} ${input.id} ${input.placeholder} ${input.getAttribute("aria-label") ?? ""}`.toLowerCase();
  if (/(email|phone|account|user|login|identifier)/.test(hints)) {
    score += 2_500;
  }

  if (input.tabIndex < 0) {
    score -= 5_000;
  }

  return score;
}

export function selectPrimaryUsernameField(
  candidates: readonly HTMLInputElement[],
): HTMLInputElement | null {
  if (candidates.length === 0) {
    return null;
  }

  if (candidates.length === 1) {
    return candidates[0] ?? null;
  }

  let best = candidates[0] ?? null;
  let bestScore = best ? scoreUsernameFieldCandidate(best) : Number.NEGATIVE_INFINITY;

  for (const candidate of candidates.slice(1)) {
    const score = scoreUsernameFieldCandidate(candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}
