const WRAPPER_ATTR = "data-vaultlock-field-wrapper";
const ACTIONS_ATTR = "data-vaultlock-actions";

const WRAPPER_STYLE =
  "position:relative;display:inline-block;width:100%;max-width:100%;overflow:visible;z-index:2147483646;";
const ACTIONS_STYLE =
  "position:absolute;right:6px;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:4px;z-index:2147483647;pointer-events:auto;";

export function ensureFieldWrapper(field: HTMLInputElement): HTMLElement {
  const existing = field.closest<HTMLElement>(`[${WRAPPER_ATTR}]`);
  if (existing) {
    return existing;
  }

  const wrapper = document.createElement("div");
  wrapper.setAttribute(WRAPPER_ATTR, "true");
  wrapper.style.cssText = WRAPPER_STYLE;

  const parent = field.parentNode;
  if (!parent) {
    return wrapper;
  }

  parent.insertBefore(wrapper, field);
  wrapper.appendChild(field);
  return wrapper;
}

export function ensureActionsHost(wrapper: HTMLElement): HTMLElement {
  const existing = wrapper.querySelector<HTMLElement>(`[${ACTIONS_ATTR}]`);
  if (existing) {
    return existing;
  }

  const host = document.createElement("div");
  host.setAttribute(ACTIONS_ATTR, "true");
  host.style.cssText = ACTIONS_STYLE;
  wrapper.appendChild(host);
  syncFieldPadding(wrapper);
  return host;
}

export function syncFieldPadding(wrapper: HTMLElement): void {
  const input = wrapper.querySelector("input");
  if (!(input instanceof HTMLInputElement)) {
    return;
  }

  const hasControl = wrapper.querySelector("[data-vaultlock-control]") !== null;
  input.style.paddingRight = hasControl ? "2rem" : "0.5rem";
}

export function markControl(element: HTMLElement): void {
  element.setAttribute("data-vaultlock-control", "true");
}
