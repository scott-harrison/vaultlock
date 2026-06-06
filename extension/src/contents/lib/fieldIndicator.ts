import { markControl } from "./fieldWrapper";
import { createThemedShadowHost } from "./themedShadowHost";

export function injectFieldIndicator(
  field: HTMLInputElement,
  actionsHost: HTMLElement,
  fieldType: "username" | "password",
): void {
  if (field.dataset.vaultlockIndicator) {
    return;
  }
  field.dataset.vaultlockIndicator = "true";

  const title =
    fieldType === "password"
      ? "VaultLock — Click to fill credentials"
      : "VaultLock — Username / email field detected";

  const { host, root } = createThemedShadowHost();
  markControl(host);

  const button = document.createElement("button");
  button.type = "button";
  button.className = `vl-indicator${fieldType === "username" ? " vl-indicator-username" : ""}`;
  button.textContent = fieldType === "password" ? "VL" : "U";
  button.title = title;
  button.setAttribute("aria-label", title);

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();

    chrome.runtime.sendMessage({
      type: "INDICATOR_CLICKED",
      hostname: window.location.hostname,
      fieldType,
      associatedFieldId: field.dataset.vaultlockAssociatedUsernameId || undefined,
    });
  });

  root.append(button);
  actionsHost.append(host);
}
