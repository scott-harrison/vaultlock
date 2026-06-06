import AUTOFILL_TOKENS_CSS from "data-text:@vaultlock/ui/styles/autofill-tokens.css";

export const SHADOW_COMPONENT_STYLES = `
  :host {
    all: initial;
    font-family: var(--font-sans);
  }

  .vl-root {
    color: var(--foreground);
    font-family: var(--font-sans);
    font-size: 11px;
    line-height: 1.2;
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
    padding: 2px 6px;
    min-height: 20px;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    box-shadow: 0 1px 2px color-mix(in oklch, var(--foreground) 12%, transparent);
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
  }

  .vl-btn-primary:hover {
    background: color-mix(in oklch, var(--primary) 88%, white);
    color: var(--primary-foreground);
  }

  .vl-btn-icon {
    padding: 2px 4px;
    min-width: 20px;
  }

  .vl-indicator {
    background: var(--primary);
    color: var(--primary-foreground);
    font-size: 9px;
    font-weight: 600;
    padding: 1px 4px;
    border-radius: calc(var(--radius) - 4px);
    border: none;
    cursor: pointer;
    line-height: 1.2;
    box-shadow: 0 1px 2px color-mix(in oklch, var(--foreground) 20%, transparent);
  }

  .vl-indicator-username {
    background: color-mix(in oklch, var(--primary) 35%, var(--muted));
    color: var(--primary-foreground);
  }

  .vl-popover {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    z-index: 2147483647;
    width: 220px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--popover);
    color: var(--popover-foreground);
    padding: 10px;
    box-shadow: 0 12px 32px color-mix(in oklch, var(--foreground) 18%, transparent);
  }

  .vl-popover[hidden] {
    display: none;
  }

  .vl-popover-title {
    font-size: 11px;
    font-weight: 600;
    margin: 0 0 8px;
  }

  .vl-field {
    display: grid;
    gap: 6px;
    margin-bottom: 8px;
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

  .vl-actions {
    display: flex;
    gap: 6px;
    margin-top: 8px;
  }

  .vl-actions .vl-btn {
    flex: 1;
  }

  .vl-host-relative {
    position: relative;
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
