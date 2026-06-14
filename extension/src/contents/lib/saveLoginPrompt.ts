import {
  isExtensionContextValid,
  safeSendMessage,
  safeSendMessageAsync,
} from "../../lib/extensionContext";
import type {
  SaveLoginAvailability,
  SaveLoginCandidate,
  SaveLoginEvaluation,
  SaveLoginPromptMode,
} from "../../lib/messaging";
import {
  isSaveLoginDismissed,
  originForCandidate,
  rememberSaveLoginDismissed,
} from "../../lib/saveLoginBannerSession";
import { createThemedShadowHost } from "./themedShadowHost";

const EVALUATION_RETRY_MS = 200;

let activeBannerHost: HTMLElement | null = null;

function removeActiveBanner(): void {
  activeBannerHost?.remove();
  activeBannerHost = null;
}

function defaultTitle(hostname: string): string {
  return hostname.replace(/^www\./, "");
}

function buildCandidate(capture: { username: string; password: string }): SaveLoginCandidate {
  return {
    hostname: window.location.hostname,
    pageUrl: window.location.href,
    username: capture.username,
    password: capture.password,
    title: defaultTitle(window.location.hostname),
  };
}

function candidateForEvaluation(candidate: SaveLoginCandidate): SaveLoginCandidate {
  const { mode: _mode, existingItemId: _existingItemId, ...fresh } = candidate;
  return fresh;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function clearPendingBannerForTab(): Promise<void> {
  await safeSendMessageAsync({ type: "CLEAR_PENDING_SAVE_LOGIN_BANNER" });
}

async function persistBannerForTab(candidate: SaveLoginCandidate): Promise<void> {
  await safeSendMessageAsync({ type: "PERSIST_SAVE_LOGIN_BANNER", candidate });
}

async function requestEvaluation(
  candidate: SaveLoginCandidate,
): Promise<SaveLoginEvaluation | null> {
  return safeSendMessageAsync<SaveLoginEvaluation>({
    type: "EVALUATE_SAVE_LOGIN_CANDIDATE",
    candidate: candidateForEvaluation(candidate),
  });
}

async function evaluateCandidate(
  candidate: SaveLoginCandidate,
  allowRetry = true,
): Promise<SaveLoginCandidate | null> {
  const evaluation = await requestEvaluation(candidate);
  if (!evaluation) {
    return null;
  }

  if (evaluation.action === "skip") {
    return null;
  }

  if (evaluation.action === "update") {
    return {
      ...candidate,
      mode: "update",
      existingItemId: evaluation.existingItemId,
    };
  }

  if (evaluation.action === "unavailable" && allowRetry) {
    await safeSendMessageAsync({ type: "REQUEST_VAULT_DEK_SYNC" });
    await delay(EVALUATION_RETRY_MS);
    return evaluateCandidate(candidate, false);
  }

  if (
    evaluation.action === "save" ||
    evaluation.action === "locked" ||
    evaluation.action === "unavailable"
  ) {
    return { ...candidate, mode: "save" };
  }

  return null;
}

function bannerCopy(mode: SaveLoginPromptMode): { title: string; actionLabel: string } {
  if (mode === "update") {
    return {
      title: "Update saved login in VaultLock?",
      actionLabel: "Update",
    };
  }

  return {
    title: "Save login to VaultLock?",
    actionLabel: "Save",
  };
}

export async function clearSaveLoginBanner(): Promise<void> {
  removeActiveBanner();
  await clearPendingBannerForTab();
}

export async function showSaveLoginBanner(candidate: SaveLoginCandidate): Promise<void> {
  if (!isExtensionContextValid() || window !== window.top) {
    return;
  }

  const resolved = await evaluateCandidate(candidate);
  if (!resolved) {
    await clearPendingBannerForTab();
    return;
  }

  const origin = originForCandidate(resolved);
  if (await isSaveLoginDismissed(origin)) {
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

  await persistBannerForTab(resolved);

  const { host, root } = createThemedShadowHost();
  host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;";

  const banner = document.createElement("div");
  banner.className = "vl-save-banner";

  const copy = bannerCopy(resolved.mode ?? "save");

  const title = document.createElement("p");
  title.className = "vl-save-title";
  title.textContent = copy.title;

  const subtitle = document.createElement("p");
  subtitle.className = "vl-save-subtitle";
  subtitle.textContent = resolved.username
    ? `${resolved.username} on ${resolved.hostname}`
    : resolved.hostname;

  const actions = document.createElement("div");
  actions.className = "vl-actions";

  const dismissButton = document.createElement("button");
  dismissButton.type = "button";
  dismissButton.className = "vl-btn";
  dismissButton.textContent = "Not now";

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "vl-btn vl-btn-primary";
  saveButton.textContent = copy.actionLabel;

  const dismiss = () => {
    void rememberSaveLoginDismissed(origin);
    void clearPendingBannerForTab();
    removeActiveBanner();
  };

  dismissButton.addEventListener("click", dismiss);

  saveButton.addEventListener("click", () => {
    safeSendMessage({ type: "SAVE_LOGIN_CANDIDATE", candidate: resolved });
    dismiss();
  });

  actions.append(dismissButton, saveButton);
  banner.append(title, subtitle, actions);
  root.appendChild(banner);
  document.body.appendChild(host);
  activeBannerHost = host;
}

export async function restorePendingSaveLoginBanner(): Promise<void> {
  if (!isExtensionContextValid() || window !== window.top) {
    return;
  }

  const candidate = await safeSendMessageAsync<SaveLoginCandidate | null>({
    type: "GET_PENDING_SAVE_LOGIN_BANNER",
  });
  if (!candidate) {
    return;
  }

  await showSaveLoginBanner(candidate);
}

export async function maybeShowSaveLoginPrompt(capture: {
  username: string;
  password: string;
}): Promise<void> {
  if (!isExtensionContextValid()) {
    return;
  }

  const candidate = buildCandidate(capture);
  const origin = originForCandidate(candidate);
  if (await isSaveLoginDismissed(origin)) {
    return;
  }

  const availability = await safeSendMessageAsync<SaveLoginAvailability>({
    type: "CHECK_SAVE_LOGIN_AVAILABLE",
  });
  if (!availability?.authenticated) {
    return;
  }

  const resolved = await evaluateCandidate(candidate);
  if (!resolved) {
    await clearSaveLoginBanner();
    return;
  }

  if (window.top !== window) {
    await safeSendMessageAsync({
      type: "QUEUE_SAVE_LOGIN_BANNER",
      candidate: resolved,
    });
    return;
  }

  await showSaveLoginBanner(resolved);
}
