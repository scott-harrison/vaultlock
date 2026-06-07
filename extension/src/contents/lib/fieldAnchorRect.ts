const WIDTH_TOLERANCE_PX = 6;
const HEIGHT_TOLERANCE_PX = 4;

export function resolveFieldAnchorRect(field: HTMLInputElement): DOMRect {
  const fieldRect = field.getBoundingClientRect();
  const parent = field.parentElement;

  if (!parent || fieldRect.width < 1 || fieldRect.height < 1) {
    return fieldRect;
  }

  const parentRect = parent.getBoundingClientRect();
  const parentStyle = window.getComputedStyle(parent);
  const widthMatches = Math.abs(parentRect.width - fieldRect.width) <= WIDTH_TOLERANCE_PX;
  const heightMatches = Math.abs(parentRect.height - fieldRect.height) <= HEIGHT_TOLERANCE_PX;
  const parentLooksLikeInputChrome =
    parentStyle.borderRadius !== "0px" ||
    Number.parseFloat(parentStyle.borderTopWidth) > 0 ||
    parentStyle.boxShadow !== "none";

  if (
    widthMatches &&
    (heightMatches || parentRect.height > fieldRect.height) &&
    parentLooksLikeInputChrome
  ) {
    return parentRect;
  }

  return fieldRect;
}

export function getFieldControlAnchor(field: HTMLInputElement): { x: number; y: number } {
  const rect = resolveFieldAnchorRect(field);
  const style = window.getComputedStyle(field);
  const paddingRight = Number.parseFloat(style.paddingRight) || 0;
  const borderRight = Number.parseFloat(style.borderRightWidth) || 0;
  const borderTop = Number.parseFloat(style.borderTopWidth) || 0;
  const borderBottom = Number.parseFloat(style.borderBottomWidth) || 0;

  const innerRight = rect.right - borderRight;
  const innerTop = rect.top + borderTop;
  const innerBottom = rect.bottom - borderBottom;
  const innerHeight = Math.max(0, innerBottom - innerTop);

  const gutter = Math.max(paddingRight, 10);
  const x = innerRight - gutter / 2;
  const y = innerTop + innerHeight / 2;

  return { x, y };
}
