import type { PlasmoCSConfig } from "plasmo";
import { installRuntimeConnectGuard } from "../lib/extensionContext";

export const config: PlasmoCSConfig = {
  all_frames: true,
  run_at: "document_start",
};

installRuntimeConnectGuard();

if (process.env.NODE_ENV === "development") {
  const PLASMO_OVERLAY_ID = "__plasmo-loading__";
  const STYLE_ID = "vaultlock-hide-plasmo-hmr";

  function suppressPlasmoHmrOverlay(): void {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `#${PLASMO_OVERLAY_ID}{display:none!important;visibility:hidden!important;pointer-events:none!important}`;
    (document.head ?? document.documentElement).appendChild(style);
  }

  suppressPlasmoHmrOverlay();

  if (typeof MutationObserver !== "undefined") {
    new MutationObserver(suppressPlasmoHmrOverlay).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
}
