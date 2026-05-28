/**
 * Content script for VaultLock (12-06+).
 *
 * Current responsibilities:
 * - Detect password fields
 * - Detect likely username / email fields (including multi-step login forms)
 * - Associate related fields when possible
 * - Inject visual indicators next to relevant login fields
 *
 * This is the foundation for smarter autofill in later sub-tasks (12-07+).
 */

console.log("[VaultLock Content] Password field detector loaded");

// --- Utility: Check if element is visible enough to be a real form field ---
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

// --- Detect password fields ---
function findPasswordFields(): HTMLInputElement[] {
  const passwordInputs = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="password"]'),
  );

  return passwordInputs.filter(isVisibleField);
}

// --- Try to find the most likely username/email field for a given password field ---
function findAssociatedUsernameField(passwordField: HTMLInputElement): HTMLInputElement | null {
  const form = passwordField.closest("form");

  // 1. Look inside the same form first (most common case)
  if (form) {
    const usernameCandidates = Array.from(
      form.querySelectorAll<HTMLInputElement>(
        'input[type="text"], input[type="email"], input:not([type])',
      ),
    ).filter(isVisibleField);

    // Prefer fields that appear before the password field in the DOM
    const beforePassword = usernameCandidates.filter((f) => {
      return f.compareDocumentPosition(passwordField) & Node.DOCUMENT_POSITION_FOLLOWING;
    });

    if (beforePassword.length > 0) {
      // Return the closest one before the password (often the immediate previous text/email field)
      return beforePassword[beforePassword.length - 1];
    }

    if (usernameCandidates.length > 0) {
      return usernameCandidates[0];
    }
  }

  // 2. Fall back to any visible username-like field on the page (multi-step scenario)
  const allUsernameFields = findUsernameOrEmailFields();
  if (allUsernameFields.length > 0) {
    // Return the last one that appears before this password field in the document
    const beforeThis = allUsernameFields.filter((f) => {
      return f.compareDocumentPosition(passwordField) & Node.DOCUMENT_POSITION_FOLLOWING;
    });
    if (beforeThis.length > 0) return beforeThis[beforeThis.length - 1];
    return allUsernameFields[0];
  }

  return null;
}

// --- Detect likely username / email fields (improved heuristics) ---
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

  // Common fields we want to *exclude* (search, filters, etc.)
  const excludeNames = ["search", "q", "query", "filter", "captcha", "code", "otp", "token"];

  return candidates.filter((input) => {
    if (!isVisibleField(input)) return false;

    const name = (input.name || "").toLowerCase();
    const id = (input.id || "").toLowerCase();
    const autocomplete = (input.autocomplete || "").toLowerCase();
    const placeholder = (input.placeholder || "").toLowerCase();
    const ariaLabel = (input.getAttribute("aria-label") || "").toLowerCase();

    // Quick exclude for obvious non-login fields
    if (excludeNames.some((ex) => name.includes(ex) || id.includes(ex))) {
      return false;
    }

    // Very strong signals
    if (autocomplete && usernameLikeAutocomplete.some((a) => autocomplete.includes(a))) {
      return true;
    }

    // Check associated label text
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

    // Additional heuristic: fields that look like they expect an email or username
    const looksLikeEmailField =
      placeholder.includes("@") ||
      ariaLabel.includes("email") ||
      labelText.includes("email") ||
      name.includes("mail");

    return looksLikeUsername || looksLikeEmailField;
  });
}

function injectIndicator(field: HTMLInputElement, fieldType: "username" | "password") {
  // Avoid injecting multiple times
  if (field.dataset.vaultlockIndicator) return;
  field.dataset.vaultlockIndicator = "true";

  const label = fieldType === "password" ? "VL" : "U";
  const title =
    fieldType === "password"
      ? "VaultLock - Click to fill credentials"
      : "VaultLock - Username / Email field detected";

  const indicator = document.createElement("div");
  indicator.textContent = label;
  indicator.title = title;
  indicator.style.cssText = `
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    background: ${fieldType === "password" ? "#2563eb" : "#16a34a"};
    color: white;
    font-size: 9px;
    font-weight: 600;
    padding: 1px 4px;
    border-radius: 2px;
    cursor: pointer;
    z-index: 2147483647;
    user-select: none;
    box-shadow: 0 1px 2px rgba(0,0,0,0.25);
    font-family: system-ui, sans-serif;
    line-height: 1;
  `;

  // Position it relative to the input
  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  wrapper.style.display = "inline-block";

  if (field.parentNode) {
    field.parentNode.insertBefore(wrapper, field);
    wrapper.appendChild(field);
    wrapper.appendChild(indicator);
  }

  indicator.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();

    console.log(`[VaultLock Content] ${fieldType} indicator clicked:`, field);

    // Placeholder - real fill logic in 12-07
    alert(`VaultLock: ${fieldType === "password" ? "Password" : "Username"} fill coming in 12-07`);
  });
}

// Scan for both username/email and password fields
function scanForLoginFields() {
  const passwordFields = findPasswordFields();
  const usernameFields = findUsernameOrEmailFields();

  // Inject indicators
  for (const field of passwordFields) injectIndicator(field, "password");
  for (const field of usernameFields) injectIndicator(field, "username");

  // --- Improved multi-step + association awareness ---
  for (const pwField of passwordFields) {
    const associatedUsername = findAssociatedUsernameField(pwField);
    if (associatedUsername) {
      // Mark the relationship for later use (12-07+)
      pwField.dataset.vaultlockAssociatedUsernameId = associatedUsername.id || "";
      associatedUsername.dataset.vaultlockAssociatedPasswordId = pwField.id || "";
    }
  }

  // Logging for debugging multi-step flows
  const hasUsername = usernameFields.length > 0;
  const hasPassword = passwordFields.length > 0;

  if (hasUsername && !hasPassword) {
    console.log(
      "[VaultLock Content] Detected username/email step (possible first step of multi-step login)",
    );
  } else if (hasPassword && !hasUsername) {
    console.log(
      "[VaultLock Content] Detected password-only step (possible second step of multi-step login)",
    );
  } else if (hasUsername && hasPassword) {
    console.log("[VaultLock Content] Detected both username and password fields on page");
  }
}

// Run on load
scanForLoginFields();

// Watch for dynamically added fields (SPAs, React, etc.)
const observer = new MutationObserver(() => {
  scanForLoginFields();
});

observer.observe(document.body || document.documentElement, {
  childList: true,
  subtree: true,
});

// --- Basic multi-step context (remember last seen username/email on this origin) ---
async function rememberLastLoginIdentifier(value: string) {
  if (!value) return;
  try {
    const origin = window.location.origin;
    await chrome.storage.session.set({
      [`lastLoginId:${origin}`]: {
        value,
        timestamp: Date.now(),
      },
    });
  } catch (err) {
    // session storage might not be available in some contexts
    console.debug("[VaultLock Content] Could not write to session storage", err);
  }
}

// Try to capture username/email values when the user types (helps multi-step)
document.addEventListener(
  "input",
  (e) => {
    const target = e.target as HTMLInputElement;
    if (!target || !["text", "email"].includes(target.type || "")) return;

    const val = target.value?.trim();
    if ((val && val.length > 2 && val.includes("@")) || val.length > 3) {
      // Heuristic: looks like an email or reasonable username
      rememberLastLoginIdentifier(val);
    }
  },
  true,
);

// Re-scan when page becomes visible again
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    scanForLoginFields();
  }
});

console.log(
  "[VaultLock Content] Field detector initialized (username + password + multi-step signals)",
);
