import { getFieldControlAnchor, resolveFieldAnchorRect } from "./fieldAnchorRect";
import { createThemedShadowHost } from "./themedShadowHost";

const PORTAL_ATTR = "data-vaultlock-menu-portal";
const MENU_WIDTH_PX = 232;
const MENU_GAP_PX = 6;
const VIEWPORT_MARGIN_PX = 8;
const TRIGGER_SIZE_PX = 22;

let portalRoot: HTMLElement | null = null;
let globalRepositionBound = false;

interface FieldOverlayAnchor {
  triggerHost: HTMLElement;
  field: HTMLInputElement;
}

const fieldAnchors = new Set<FieldOverlayAnchor>();

export function getMenuPortalRoot(): HTMLElement {
  if (!portalRoot) {
    const { host, root } = createThemedShadowHost();
    host.setAttribute(PORTAL_ATTR, "true");
    host.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;pointer-events:none;overflow:visible;";
    document.body.appendChild(host);
    portalRoot = root;
  }

  return portalRoot;
}

export function mountFieldTrigger(triggerHost: HTMLElement): void {
  triggerHost.style.pointerEvents = "auto";
  document.body.appendChild(triggerHost);
}

export function registerFieldOverlay(triggerHost: HTMLElement, field: HTMLInputElement): void {
  fieldAnchors.add({ triggerHost, field });
  ensureGlobalReposition();
  positionFieldTrigger(triggerHost, field);
}

export function repositionAllFieldTriggers(): void {
  for (const anchor of fieldAnchors) {
    positionFieldTrigger(anchor.triggerHost, anchor.field);
  }
}

export function positionFieldTrigger(triggerHost: HTMLElement, field: HTMLInputElement): void {
  const rect = resolveFieldAnchorRect(field);
  const { x, y, visible: anchorVisible } = getFieldControlAnchor(field);
  const inViewport =
    rect.bottom > 0 &&
    rect.top < window.innerHeight &&
    rect.right > 0 &&
    rect.left < window.innerWidth;
  const visible = anchorVisible && inViewport;

  triggerHost.style.visibility = visible ? "visible" : "hidden";
  if (!visible) {
    return;
  }

  triggerHost.style.position = "fixed";
  triggerHost.style.width = `${TRIGGER_SIZE_PX}px`;
  triggerHost.style.height = `${TRIGGER_SIZE_PX}px`;
  triggerHost.style.top = `${y}px`;
  triggerHost.style.left = `${x}px`;
  triggerHost.style.transform = "translate(-50%, -50%)";
  triggerHost.style.margin = "0";
}

export function positionFloatingMenu(menu: HTMLElement, field: HTMLInputElement): void {
  const anchorRect = resolveFieldAnchorRect(field);
  const menuHeight = menu.offsetHeight || 160;
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const openAbove =
    spaceBelow < menuHeight + MENU_GAP_PX && anchorRect.top > menuHeight + MENU_GAP_PX;

  const top = openAbove
    ? anchorRect.top - menuHeight - MENU_GAP_PX
    : anchorRect.bottom + MENU_GAP_PX;

  const left = Math.min(
    Math.max(VIEWPORT_MARGIN_PX, anchorRect.right - MENU_WIDTH_PX),
    window.innerWidth - MENU_WIDTH_PX - VIEWPORT_MARGIN_PX,
  );

  menu.style.top = `${Math.max(VIEWPORT_MARGIN_PX, top)}px`;
  menu.style.left = `${left}px`;
}

export function bindMenuReposition(
  menu: HTMLElement,
  field: HTMLInputElement,
  isOpen: () => boolean,
): () => void {
  const reposition = () => {
    if (isOpen()) {
      positionFloatingMenu(menu, field);
    }
  };

  window.addEventListener("scroll", reposition, true);
  window.addEventListener("resize", reposition);

  return () => {
    window.removeEventListener("scroll", reposition, true);
    window.removeEventListener("resize", reposition);
  };
}

function ensureGlobalReposition(): void {
  if (globalRepositionBound) {
    return;
  }

  const repositionAll = () => {
    for (const anchor of fieldAnchors) {
      positionFieldTrigger(anchor.triggerHost, anchor.field);
    }
  };

  window.addEventListener("scroll", repositionAll, true);
  window.addEventListener("resize", repositionAll);
  globalRepositionBound = true;
}
