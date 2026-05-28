/**
 * Content script for VaultLock (12-06+).
 *
 * Responsibilities in this sub-task:
 * - Detect password input fields on the page.
 * - (Future) Detect associated username/email fields.
 * - Inject a small visual indicator (icon or badge) next to password fields.
 * - Communicate with the extension when the user interacts with the indicator.
 *
 * This is the foundation for autofill.
 */

console.log("[VaultLock Content] Password field detector loaded");

// Basic password field detection
function findPasswordFields(): HTMLInputElement[] {
  const passwordInputs = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="password"]'),
  );

  // Filter out hidden or very small fields (common for anti-bot / honeypots)
  return passwordInputs.filter((input) => {
    const style = window.getComputedStyle(input);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      input.offsetWidth > 20 &&
      input.offsetHeight > 10
    );
  });
}

function injectIndicator(field: HTMLInputElement) {
  // Avoid injecting multiple times
  if (field.dataset.vaultlockIndicator) return;
  field.dataset.vaultlockIndicator = "true";

  // Create a small indicator
  const indicator = document.createElement("div");
  indicator.textContent = "VL";
  indicator.title = "VaultLock - Click to fill credentials";
  indicator.style.cssText = `
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: #2563eb;
    color: white;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 5px;
    border-radius: 3px;
    cursor: pointer;
    z-index: 2147483647;
    user-select: none;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    font-family: system-ui, sans-serif;
  `;

  // Position it relative to the input
  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  wrapper.style.display = "inline-block";

  // Insert wrapper and move the field inside
  if (field.parentNode) {
    field.parentNode.insertBefore(wrapper, field);
    wrapper.appendChild(field);
    wrapper.appendChild(indicator);
  }

  // Basic click handler (will be expanded in 12-07)
  indicator.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();

    console.log("[VaultLock Content] Indicator clicked for field:", field);

    // For now just alert — real fill logic comes in 12-07
    alert("VaultLock: Fill functionality coming soon (12-07)");
  });
}

// Initial scan
function scanForPasswordFields() {
  const fields = findPasswordFields();
  fields.forEach(injectIndicator);
}

// Run on load
scanForPasswordFields();

// Also watch for dynamically added fields (common in SPAs and modern login forms)
const observer = new MutationObserver(() => {
  scanForPasswordFields();
});

observer.observe(document.body || document.documentElement, {
  childList: true,
  subtree: true,
});

// Re-scan when the page becomes visible again (some sites lazy-load forms)
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    scanForPasswordFields();
  }
});

console.log("[VaultLock Content] Password field detector initialized");
