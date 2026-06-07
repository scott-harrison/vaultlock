import {
  isExtensionContextValid,
  safeSendMessage,
  safeSendMessageAsync,
} from "../../lib/extensionContext";
import type { SaveLoginAvailability, SaveLoginCandidate } from "../../lib/messaging";
import { createThemedShadowHost } from "./themedShadowHost";

const DISMISS_TTL_MS = 30 * 60 * 1000;
const DISMISS_KEY_PREFIX = "vaultlock:saveDismissed:";

let activeBannerHost: HTMLElement | null = null;

function dismissKeyForOrigin(origin: string): string {
  return `${DISMISS_KEY_PREFIX}${origin}`;
}

function isDismissedRecently(origin: string): boolean {
  try {
    const raw = sessionStorage.getItem(dismissKeyForOrigin(origin));
    if (!raw) {
      return false;
    }

    const dismissedAt = Number(raw);
    if (!Number.isFinite(dismissedAt)) {
      return false;
    }

    return Date.now() - dismissedAt < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function rememberDismissed(origin: string): void {
  try {
    sessionStorage.setItem(dismissKeyForOrigin(origin), String(Date.now()));
  } catch {
    // ignore
  }
}

function removeActiveBanner(): void {
  activeBannerHost?.remove();
  activeBannerHost = null;
}

function defaultTitle(hostname: string): string {
  return hostname.replace(/^www\./, "");
}

export async function maybeShowSaveLoginPrompt(capture: {
  username: string;
  password: string;
}): Promise<void> {
  if (!isExtensionContextValid()) {
    return;
  }

  const origin = window.location.origin;
  if (isDismissedRecently(origin)) {
    return;
  }

  const availability = await safeSendMessageAsync<SaveLoginAvailability>({
    type: "CHECK_SAVE_LOGIN_AVAILABLE",
  });
  if (!availability?.authenticated) {
    return;
  }

  if (activeBannerHost) {
    return;
  }

  const candidate: SaveLoginCandidate = {
    hostname: window.location.hostname,
    pageUrl: window.location.href,
    username: capture.username,
    password: capture.password,
    title: defaultTitle(window.location.hostname),
  };

  const { host, root } = createThemedShadowHost();
  host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;";

  const banner = document.createElement("div");
  banner.className = "vl-save-banner";

  const title = document.createElement("p");
  title.className = "vl-save-title";
  title.textContent = "Save login to VaultLock?";

  const subtitle = document.createElement("p");
  subtitle.className = "vl-save-subtitle";
  subtitle.textContent = capture.username
    ? `${capture.username} on ${candidate.hostname}`
    : candidate.hostname;

  const actions = document.createElement("div");
  actions.className = "vl-actions";

  const dismissButton = document.createElement("button");
  dismissButton.type = "button";
  dismissButton.className = "vl-btn";
  dismissButton.textContent = "Not now";

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "vl-btn vl-btn-primary";
  saveButton.textContent = "Save";

  dismissButton.addEventListener("click", () => {
    rememberDismissed(origin);
    removeActiveBanner();
  });

  saveButton.addEventListener("click", () => {
    safeSendMessage({ type: "SAVE_LOGIN_CANDIDATE", candidate });
    rememberDismissed(origin);
    removeActiveBanner();
  });

  actions.append(dismissButton, saveButton);
  banner.append(title, subtitle, actions);
  root.appendChild(banner);
  document.body.appendChild(host);
  activeBannerHost = host;
}
