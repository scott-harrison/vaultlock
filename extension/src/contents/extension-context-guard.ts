import type { PlasmoCSConfig } from "plasmo";
import { installRuntimeConnectGuard } from "../lib/extensionContext";

export const config: PlasmoCSConfig = {
  all_frames: true,
  run_at: "document_start",
};

const PLASMO_HMR_OVERLAY_ID = "__plasmo-loading__";
const PLASMO_OVERLAY_STYLE_ID = "vaultlock-hide-plasmo-hmr";

function isPlasmoHmrOverlay(node: Node): node is HTMLElement {
  return node instanceof HTMLElement && node.id === PLASMO_HMR_OVERLAY_ID;
}

function injectPlasmoOverlayHideStyles(): void {
  if (document.getElementById(PLASMO_OVERLAY_STYLE_ID)) {
    return;
  }

  const css = `#${PLASMO_HMR_OVERLAY_ID}{display:none!important;visibility:hidden!important;pointer-events:none!important;opacity:0!important}`;

  const style = document.createElement("style");
  style.id = PLASMO_OVERLAY_STYLE_ID;
  style.textContent = css;
  (document.head ?? document.documentElement).appendChild(style);
}

function removePlasmoHmrOverlay(): void {
  document.getElementById(PLASMO_HMR_OVERLAY_ID)?.remove();
}

function blockPlasmoOverlayInsertion(): void {
  const originalAppendChild = Element.prototype.appendChild;
  const originalInsertBefore = Element.prototype.insertBefore;

  Element.prototype.appendChild = function appendChild<T extends Node>(child: T): T {
    if (isPlasmoHmrOverlay(child)) {
      return child;
    }

    return originalAppendChild.call(this, child) as T;
  };

  Element.prototype.insertBefore = function insertBefore<T extends Node>(
    child: T,
    referenceNode: Node | null,
  ): T {
    if (isPlasmoHmrOverlay(child)) {
      return child;
    }

    return originalInsertBefore.call(this, child, referenceNode) as T;
  };
}

function suppressPlasmoHmrOverlay(): void {
  injectPlasmoOverlayHideStyles();
  removePlasmoHmrOverlay();
}

function installPlasmoHmrOverlaySuppression(): void {
  suppressPlasmoHmrOverlay();
  blockPlasmoOverlayInsertion();

  if (typeof MutationObserver === "undefined") {
    return;
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes" && isPlasmoHmrOverlay(record.target)) {
        removePlasmoHmrOverlay();
        return;
      }

      if (record.type !== "childList") {
        continue;
      }

      for (const node of record.addedNodes) {
        if (isPlasmoHmrOverlay(node)) {
          removePlasmoHmrOverlay();
          return;
        }
      }
    }

    if (document.getElementById(PLASMO_HMR_OVERLAY_ID)) {
      removePlasmoHmrOverlay();
    }
  });

  const root = document.documentElement;
  if (root) {
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "id"],
    });
  }
}

installRuntimeConnectGuard();

if (process.env.NODE_ENV === "development") {
  installPlasmoHmrOverlaySuppression();
}
