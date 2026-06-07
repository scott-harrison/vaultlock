import { createThemedShadowHost } from "./themedShadowHost";

const PORTAL_ATTR = "data-vaultlock-menu-portal";
const MENU_WIDTH_PX = 232;
const MENU_GAP_PX = 6;
const VIEWPORT_MARGIN_PX = 8;

let portalRoot: HTMLElement | null = null;

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

export function positionFloatingMenu(menu: HTMLElement, anchor: HTMLElement): void {
  const anchorRect = anchor.getBoundingClientRect();
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
  anchor: HTMLElement,
  isOpen: () => boolean,
): () => void {
  const reposition = () => {
    if (isOpen()) {
      positionFloatingMenu(menu, anchor);
    }
  };

  window.addEventListener("scroll", reposition, true);
  window.addEventListener("resize", reposition);

  return () => {
    window.removeEventListener("scroll", reposition, true);
    window.removeEventListener("resize", reposition);
  };
}
