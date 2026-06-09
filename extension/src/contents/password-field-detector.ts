import type { PlasmoCSConfig } from "plasmo";
import {
  isExtensionContextValid,
  onExtensionContextInvalidated,
  safeSessionStorageSet,
} from "../lib/extensionContext";
import { fillLoginFields } from "../lib/formFillDom";
import type { ExecuteFillPayload, SaveLoginCandidate } from "../lib/messaging";
import { injectFieldActionControl } from "./lib/fieldActionControl";
import { repositionAllFieldTriggers } from "./lib/fieldMenuPortal";
import { initSaveLoginDetection } from "./lib/saveLoginDetector";
import { restorePendingSaveLoginBanner, showSaveLoginBanner } from "./lib/saveLoginPrompt";

export const config: PlasmoCSConfig = {
  all_frames: true,
  run_at: "document_idle",
};

/**
 * Content script for VaultLock.
 *
 * Responsibilities:
 * - Detect password fields
 * - Detect likely username / email fields (including multi-step login forms)
 * - Associate related fields when possible
 * - Inject a single VaultLock action control per detected field
 */

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

function findPasswordFields(): HTMLInputElement[] {
  const passwordInputs = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="password"]'),
  );

  return passwordInputs.filter(isVisibleField);
}

function findAssociatedUsernameField(passwordField: HTMLInputElement): HTMLInputElement | null {
  const form = passwordField.closest("form");

  if (form) {
    const usernameCandidates = Array.from(
      form.querySelectorAll<HTMLInputElement>(
        'input[type="text"], input[type="email"], input:not([type])',
      ),
    ).filter(isVisibleField);

    const beforePassword = usernameCandidates.filter((f) => {
      return f.compareDocumentPosition(passwordField) & Node.DOCUMENT_POSITION_FOLLOWING;
    });

    if (beforePassword.length > 0) {
      return beforePassword[beforePassword.length - 1];
    }

    if (usernameCandidates.length > 0) {
      return usernameCandidates[0];
    }
  }

  const allUsernameFields = findUsernameOrEmailFields();
  if (allUsernameFields.length > 0) {
    const beforeThis = allUsernameFields.filter((f) => {
      return f.compareDocumentPosition(passwordField) & Node.DOCUMENT_POSITION_FOLLOWING;
    });
    if (beforeThis.length > 0) return beforeThis[beforeThis.length - 1];
    return allUsernameFields[0];
  }

  return null;
}

function findUsernameOrEmailFields(): HTMLInputElement[] {
  const candidates = Array.from(
    document.querySelectorAll<HTMLInputElement>(
      'input[type="text"], input[type="email"], input:not([type])',
    ),
  );

  const usernameLikeNames = [
    "user",
    "username",
    "login",
    "email",
    "e-mail",
    "userid",
    "user_id",
    "account",
    "identity",
    "identifier",
    "handle",
    "uname",
  ];

  const usernameLikeAutocomplete = ["username", "email", "username webauthn"];
  const excludeNames = ["search", "q", "query", "filter", "captcha", "code", "otp", "token"];

  return candidates.filter((input) => {
    if (!isVisibleField(input)) return false;

    const name = (input.name || "").toLowerCase();
    const id = (input.id || "").toLowerCase();
    const autocomplete = (input.autocomplete || "").toLowerCase();
    const placeholder = (input.placeholder || "").toLowerCase();
    const ariaLabel = (input.getAttribute("aria-label") || "").toLowerCase();

    if (excludeNames.some((ex) => name.includes(ex) || id.includes(ex))) {
      return false;
    }

    if (autocomplete && usernameLikeAutocomplete.some((a) => autocomplete.includes(a))) {
      return true;
    }

    let labelText = "";
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) labelText = label.textContent?.toLowerCase() || "";
    }
    if (!labelText && input.closest("label")) {
      labelText = input.closest("label")?.textContent?.toLowerCase() || "";
    }

    const combined = `${name} ${id} ${placeholder} ${ariaLabel} ${labelText}`;
    const looksLikeUsername = usernameLikeNames.some((keyword) => combined.includes(keyword));
    const looksLikeEmailField =
      placeholder.includes("@") ||
      ariaLabel.includes("email") ||
      labelText.includes("email") ||
      name.includes("mail");

    return looksLikeUsername || looksLikeEmailField;
  });
}

function decorateField(field: HTMLInputElement, fieldType: "username" | "password"): void {
  injectFieldActionControl(field, fieldType);
}

function isExtensionSender(sender: chrome.runtime.MessageSender): boolean {
  try {
    return sender.id === chrome.runtime.id;
  } catch {
    return false;
  }
}

const extensionContextActive = isExtensionContextValid();

if (extensionContextActive) {
  chrome.runtime.onMessage.addListener(
    (
      message: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void,
    ) => {
      if (!isExtensionSender(sender)) {
        sendResponse({ success: false, error: "Invalid sender" });
        return;
      }

      const msg = message as Partial<ExecuteFillPayload> & {
        type?: string;
        candidate?: SaveLoginCandidate;
      };

      if (msg.type === "RENDER_SAVE_LOGIN_BANNER" && msg.candidate) {
        if (window === window.top) {
          void showSaveLoginBanner(msg.candidate).then(() => {
            sendResponse({ success: true });
          });
        } else {
          sendResponse({ success: false, error: "Banner renders in top frame only" });
        }
        return true;
      }

      if (msg.type !== "EXECUTE_FILL") return;

      if (msg.hostname !== window.location.hostname) {
        sendResponse({ success: false, error: "Hostname mismatch" });
        return true;
      }

      if (!msg.password && !msg.username) {
        sendResponse({ success: false, error: "Nothing to fill" });
        return true;
      }

      try {
        const result = fillLoginFields({
          username: msg.username ?? "",
          password: msg.password ?? "",
          triggerFieldType: msg.fieldType ?? "password",
          associatedFieldId: msg.associatedFieldId,
        });

        if (!result.filledUsername && !result.filledPassword) {
          sendResponse({ success: false, error: "No matching fields found on this page" });
          return true;
        }

        sendResponse({ success: true, ...result });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Fill failed";
        sendResponse({ success: false, error: message });
      }

      return true;
    },
  );
}

function scanForLoginFields() {
  const passwordFields = findPasswordFields();
  const usernameFields = findUsernameOrEmailFields();

  for (const field of passwordFields) decorateField(field, "password");
  for (const field of usernameFields) decorateField(field, "username");

  for (const pwField of passwordFields) {
    const associatedUsername = findAssociatedUsernameField(pwField);
    if (associatedUsername) {
      pwField.dataset.vaultlockAssociatedUsernameId = associatedUsername.id || "";
      associatedUsername.dataset.vaultlockAssociatedPasswordId = pwField.id || "";
    }
  }

  repositionAllFieldTriggers();
}

initSaveLoginDetection();

if (extensionContextActive) {
  scanForLoginFields();
  if (window === window.top) {
    void restorePendingSaveLoginBanner();
  }
}

const observer = new MutationObserver(() => {
  if (!isExtensionContextValid()) {
    observer.disconnect();
    return;
  }
  scanForLoginFields();
});

if (extensionContextActive && (document.body || document.documentElement)) {
  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
  });

  onExtensionContextInvalidated(() => {
    observer.disconnect();
  });
}

async function rememberLastLoginIdentifier(value: string) {
  if (!value || !isExtensionContextValid()) return;
  const origin = window.location.origin;
  await safeSessionStorageSet({
    [`lastLoginId:${origin}`]: {
      value,
      timestamp: Date.now(),
    },
  });
}

if (extensionContextActive) {
  document.addEventListener(
    "input",
    (e) => {
      const target = e.target as HTMLInputElement;
      if (!target || !["text", "email"].includes(target.type || "")) return;

      const val = target.value?.trim();
      if ((val && val.length > 2 && val.includes("@")) || val.length > 3) {
        rememberLastLoginIdentifier(val);
      }
    },
    true,
  );

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && isExtensionContextValid()) {
      scanForLoginFields();
    }
  });

  if (window === window.top) {
    window.addEventListener("pageshow", () => {
      if (isExtensionContextValid()) {
        void restorePendingSaveLoginBanner();
      }
    });
  }
}
