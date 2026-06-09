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
