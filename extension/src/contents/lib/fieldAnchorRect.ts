const TRIGGER_SIZE_PX = 22;
const CONTROL_GAP_PX = 4;
const MIN_INSET_PX = 6;
const RIGHT_GUTTER_RATIO = 0.45;

const NATIVE_CONTROL_SELECTORS = [
  "button",
  '[role="button"]',
  "a[href]",
  '[class*="icon" i]',
  '[class*="toggle" i]',
  '[class*="clear" i]',
  '[class*="reveal" i]',
  "svg",
].join(",");

const VAULTLOCK_SELECTOR = "[data-vaultlock-trigger],[data-vaultlock-menu-portal]";

export function resolveFieldAnchorRect(field: HTMLInputElement): DOMRect {
  return field.getBoundingClientRect();
}

export function getFieldControlAnchor(field: HTMLInputElement): {
  x: number;
  y: number;
  visible: boolean;
} {
  const rect = field.getBoundingClientRect();
  const style = window.getComputedStyle(field);

  if (rect.width < TRIGGER_SIZE_PX + MIN_INSET_PX * 2 || rect.height < 12) {
    return { x: 0, y: 0, visible: false };
  }

  const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(style.paddingRight) || 0;
  const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0;
  const borderRight = Number.parseFloat(style.borderRightWidth) || 0;
  const borderTop = Number.parseFloat(style.borderTopWidth) || 0;
  const borderBottom = Number.parseFloat(style.borderBottomWidth) || 0;

  const innerLeft = rect.left + borderLeft;
  const innerRight = rect.right - borderRight;
  const innerTop = rect.top + borderTop;
  const innerBottom = rect.bottom - borderBottom;
  const innerWidth = Math.max(0, innerRight - innerLeft);
  const innerHeight = Math.max(0, innerBottom - innerTop);

  const minCenterX = innerLeft + paddingLeft + TRIGGER_SIZE_PX / 2 + MIN_INSET_PX;
  const maxCenterX = innerRight - paddingRight - TRIGGER_SIZE_PX / 2 - MIN_INSET_PX;

  if (maxCenterX < minCenterX) {
    return { x: 0, y: 0, visible: false };
  }

  const nativeControls = findNativeInputControls(field);
  let centerX: number;

  if (nativeControls.length > 0) {
    const leftmostControl = Math.min(...nativeControls.map((control) => control.left));
    centerX = leftmostControl - CONTROL_GAP_PX - TRIGGER_SIZE_PX / 2;
  } else {
    const rightInset = Math.max(MIN_INSET_PX + TRIGGER_SIZE_PX / 2, paddingRight / 2);
    centerX = innerRight - rightInset;
  }

  centerX = Math.max(minCenterX, Math.min(maxCenterX, centerX));

  const y = innerTop + innerHeight / 2;
  const visible = centerX + TRIGGER_SIZE_PX / 2 <= innerRight - MIN_INSET_PX;

  return { x: centerX, y, visible };
}

function findNativeInputControls(field: HTMLInputElement): DOMRect[] {
  const fieldRect = field.getBoundingClientRect();
  const containers = collectInputContainers(field);
  const controls: DOMRect[] = [];

  for (const container of containers) {
    for (const element of container.querySelectorAll(NATIVE_CONTROL_SELECTORS)) {
      if (!(element instanceof HTMLElement)) {
        continue;
      }

      if (element.matches(VAULTLOCK_SELECTOR) || element.closest(VAULTLOCK_SELECTOR)) {
        continue;
      }

      if (element === field || field.contains(element)) {
        continue;
      }

      const controlRect = element.getBoundingClientRect();
      if (!isVisibleControl(controlRect) || !overlapsInputRightGutter(fieldRect, controlRect)) {
        continue;
      }

      controls.push(controlRect);
    }
  }

  return controls;
}

function collectInputContainers(field: HTMLInputElement): HTMLElement[] {
  const containers: HTMLElement[] = [];
  let current: HTMLElement | null = field.parentElement;

  for (let depth = 0; current && depth < 3; depth += 1) {
    containers.push(current);
    current = current.parentElement;
  }

  return containers;
}

function isVisibleControl(rect: DOMRect): boolean {
  return rect.width >= 8 && rect.height >= 8;
}

function overlapsInputRightGutter(fieldRect: DOMRect, controlRect: DOMRect): boolean {
  const gutterLeft = fieldRect.left + fieldRect.width * (1 - RIGHT_GUTTER_RATIO);
  const verticallyAligned =
    controlRect.bottom > fieldRect.top + 2 && controlRect.top < fieldRect.bottom - 2;
  const inRightGutter =
    controlRect.right > gutterLeft && controlRect.left < fieldRect.right + CONTROL_GAP_PX;

  return verticallyAligned && inRightGutter;
}
