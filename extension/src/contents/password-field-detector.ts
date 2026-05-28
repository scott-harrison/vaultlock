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

// --- Detect likely username / email fields ---
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
  ];

  const usernameLikeAutocomplete = ["username", "email", "username webauthn"];

  return candidates.filter((input) => {
    if (!isVisibleField(input)) return false;

    const name = (input.name || "").toLowerCase();
    const id = (input.id || "").toLowerCase();
    const autocomplete = (input.autocomplete || "").toLowerCase();
    const placeholder = (input.placeholder || "").toLowerCase();

    // Strong signals
    if (autocomplete && usernameLikeAutocomplete.some((a) => autocomplete.includes(a))) {
      return true;
    }

    const combined = `${name} ${id} ${placeholder}`;

    return usernameLikeNames.some((keyword) => combined.includes(keyword));
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

  // Basic multi-step awareness logging (for debugging / future use)
  if (usernameFields.length > 0 && passwordFields.length === 0) {
    console.log("[VaultLock Content] Likely first step of login (username/email only)");
  }
  if (passwordFields.length > 0 && usernameFields.length === 0) {
    console.log("[VaultLock Content] Likely second step of login (password only)");
  }
  if (usernameFields.length > 0 && passwordFields.length > 0) {
    console.log("[VaultLock Content] Classic single-page login form detected");
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

// Re-scan when page becomes visible again
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    scanForLoginFields();
  }
});

console.log(
  "[VaultLock Content] Field detector initialized (username + password + multi-step signals)",
);
