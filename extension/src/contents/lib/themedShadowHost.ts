import AUTOFILL_TOKENS_CSS from "data-text:@vaultlock/ui/styles/autofill-tokens.css";

export const SHADOW_COMPONENT_STYLES = `
  :host {
    all: initial;
    font-family: var(--font-sans);
    display: block;
    box-sizing: border-box;
    z-index: 2147483647;
  }

  .vl-root {
    width: 100%;
    height: 100%;
    color: var(--foreground);
    font-family: var(--font-sans);
    font-size: 11px;
    line-height: 1.3;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .vl-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    max-width: 22px;
    max-height: 22px;
    padding: 0;
    border: none;
    border-radius: 999px;
    background: color-mix(in oklch, var(--primary) 14%, transparent);
    color: color-mix(in oklch, var(--primary) 72%, var(--foreground));
    cursor: pointer;
    opacity: 0.55;
    transition: opacity 120ms ease, background 120ms ease, color 120ms ease, box-shadow 120ms ease;
  }

  .vl-trigger:hover,
  .vl-trigger:focus-visible,
  .vl-trigger[aria-expanded="true"] {
    opacity: 1;
    background: color-mix(in oklch, var(--primary) 22%, transparent);
    color: var(--primary);
    box-shadow: 0 0 0 1px color-mix(in oklch, var(--primary) 28%, transparent);
  }

  .vl-trigger:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 1px;
  }

  .vl-menu {
    position: fixed;
    z-index: 2147483647;
    width: 232px;
    pointer-events: auto;
    border: 1px solid color-mix(in oklch, var(--border) 85%, transparent);
    border-radius: var(--radius);
    background: var(--popover);
    color: var(--popover-foreground);
    padding: 8px;
    box-shadow:
      0 4px 16px color-mix(in oklch, var(--foreground) 10%, transparent),
      0 12px 32px color-mix(in oklch, var(--foreground) 14%, transparent);
  }

  .vl-menu[hidden] {
    display: none;
  }

  .vl-menu-title {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted-foreground);
    margin: 0 4px 6px;
  }

  .vl-menu-actions {
    display: grid;
    gap: 2px;
  }

  .vl-menu-item {
    display: grid;
    gap: 2px;
    width: 100%;
    text-align: left;
    border: none;
    border-radius: calc(var(--radius) - 2px);
    background: transparent;
    color: inherit;
    padding: 8px;
    cursor: pointer;
  }

  .vl-menu-item:hover,
  .vl-menu-item:focus-visible {
    background: var(--accent);
    color: var(--accent-foreground);
    outline: none;
  }

  .vl-menu-item-label {
    font-size: 12px;
    font-weight: 500;
  }

  .vl-menu-item-hint {
    font-size: 10px;
    color: var(--muted-foreground);
  }

  .vl-menu-item:hover .vl-menu-item-hint,
  .vl-menu-item:focus-visible .vl-menu-item-hint {
    color: color-mix(in oklch, var(--accent-foreground) 72%, transparent);
  }

  .vl-menu-section {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
  }

  .vl-menu-section[hidden] {
    display: none;
  }

  .vl-generator {
    display: grid;
    gap: 8px;
  }

  .vl-field {
    display: grid;
    gap: 6px;
  }

  .vl-label {
    font-size: 10px;
    color: var(--muted-foreground);
  }

  .vl-range {
    width: 100%;
    accent-color: var(--primary);
  }

  .vl-toggles {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .vl-toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) - 2px);
    padding: 2px 6px;
    font-size: 10px;
    color: var(--muted-foreground);
    cursor: pointer;
  }

  .vl-toggle input {
    margin: 0;
    accent-color: var(--primary);
  }

  .vl-generator-preview {
    margin: 0;
    padding: 6px 8px;
    border-radius: calc(var(--radius) - 2px);
    background: var(--muted);
    color: var(--foreground);
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 10px;
    word-break: break-all;
  }

  .vl-actions {
    display: flex;
    gap: 6px;
  }

  .vl-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    border: 1px solid color-mix(in oklch, var(--border) 80%, transparent);
    border-radius: calc(var(--radius) - 2px);
    background: var(--card);
    color: var(--foreground);
    padding: 4px 8px;
    min-height: 24px;
    font-size: 11px;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }

  .vl-btn:hover {
    background: var(--accent);
    color: var(--accent-foreground);
  }

  .vl-btn:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 1px;
  }

  .vl-btn-primary {
    background: var(--primary);
    border-color: var(--primary);
    color: var(--primary-foreground);
    flex: 1;
  }

  .vl-btn-primary:hover {
    background: color-mix(in oklch, var(--primary) 88%, white);
    color: var(--primary-foreground);
  }

  .vl-actions .vl-btn:not(.vl-btn-primary) {
    flex: 0 0 auto;
  }
`;

export interface ThemedShadowHost {
  host: HTMLElement;
  root: HTMLElement;
}

export function createThemedShadowHost(): ThemedShadowHost {
  const host = document.createElement("div");
  const shadow = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = `${AUTOFILL_TOKENS_CSS}\n${SHADOW_COMPONENT_STYLES}`;
  shadow.appendChild(style);

  const root = document.createElement("div");
  root.className = "vl-root dark";
  root.setAttribute("data-theme", "modern-minimal-dark");
  shadow.appendChild(root);

  return { host, root };
}
