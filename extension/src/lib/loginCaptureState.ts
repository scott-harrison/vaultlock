const PASSWORD_AUTOCOMPLETE = new Set(["new-password", "current-password"]);

let cachedUsername = "";
let cachedPassword = "";

function isPasswordInput(input: HTMLInputElement): boolean {
  if (input.type === "password") {
    return true;
  }

  return PASSWORD_AUTOCOMPLETE.has((input.autocomplete || "").toLowerCase());
}

function isUsernameInput(input: HTMLInputElement): boolean {
  if (input.dataset.vaultlockSkipSave === "1") {
    return false;
  }

  const type = (input.type || "text").toLowerCase();
  if (type === "password" || type === "hidden" || type === "checkbox" || type === "radio") {
    return false;
  }

  const autocomplete = (input.autocomplete || "").toLowerCase();
  if (autocomplete.includes("username") || autocomplete.includes("email")) {
    return true;
  }

  const combined =
    `${input.name} ${input.id} ${input.placeholder} ${input.getAttribute("aria-label") ?? ""}`.toLowerCase();
  return /email|user|login|account|identifier/.test(combined);
}

export function trackLoginFieldInput(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || target.dataset.vaultlockSkipSave === "1") {
    return;
  }

  if (isPasswordInput(target)) {
    cachedPassword = target.value;
    return;
  }

  if (isUsernameInput(target)) {
    cachedUsername = target.value.trim();
  }
}

export function mergeCapturedLogin(capture: { username: string; password: string } | null): {
  username: string;
  password: string;
} | null {
  const password = (capture?.password || cachedPassword).trim();
  if (!password) {
    return null;
  }

  const username = (capture?.username || cachedUsername).trim();
  return { username, password };
}

export async function resolveRememberedUsername(origin: string): Promise<string> {
  try {
    const key = `lastLoginId:${origin}`;
    const result = await chrome.storage.session.get(key);
    const entry = result[key] as { value?: string } | undefined;
    return entry?.value?.trim() ?? "";
  } catch {
    return "";
  }
}

export async function enrichCapturedLogin(
  capture: { username: string; password: string } | null,
): Promise<{ username: string; password: string } | null> {
  const merged = mergeCapturedLogin(capture);
  if (!merged) {
    return null;
  }

  if (merged.username) {
    return merged;
  }

  const remembered = await resolveRememberedUsername(window.location.origin);
  if (!remembered) {
    return merged;
  }

  return { ...merged, username: remembered };
}
