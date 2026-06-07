const SUBMIT_LABEL_PATTERN =
  /\b(sign[\s-]?up|register|create(?:\s+(?:an?\s+)?account)?|log[\s-]?in|sign[\s-]?in|continue|next|submit|join|get[\s-]?started)\b/i;
const EXCLUDE_LABEL_PATTERN = /\b(cancel|back|skip|close|not\s+now|maybe\s+later|forgot|reset)\b/i;

function controlLabel(element: Element): string {
  const parts = [
    element.textContent,
    element.getAttribute("aria-label"),
    element.getAttribute("value"),
    element.getAttribute("name"),
    element.getAttribute("id"),
    element.getAttribute("data-testid"),
    element.className,
  ];

  return parts
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ");
}

export function isSubmitLikeControl(element: Element): boolean {
  if (element instanceof HTMLInputElement && element.type === "submit") {
    return true;
  }

  if (element instanceof HTMLButtonElement && element.type === "submit") {
    return true;
  }

  const label = controlLabel(element);
  if (!label.trim()) {
    return false;
  }

  if (EXCLUDE_LABEL_PATTERN.test(label)) {
    return false;
  }

  return SUBMIT_LABEL_PATTERN.test(label);
}

export function findClickedSubmitControl(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest(
    'button, input[type="submit"], input[type="button"], a[role="button"], [role="button"]',
  );
}
