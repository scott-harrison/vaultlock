export const MAIN_WORLD_FILL_REQUEST_EVENT = "vaultlock:main-world-fill-request";

export interface MainWorldFillRequestDetail {
  element?: HTMLInputElement;
  fieldId?: string;
  vaultlockFieldId?: string;
  value: string;
  nudgeTrustedInput: boolean;
  preferTypedInsert: boolean;
  success: boolean;
}

export interface MainWorldFillRequestOptions {
  nudgeTrustedInput?: boolean;
  preferTypedInsert?: boolean;
}

export function resolveMainWorldFillTarget(
  detail: Pick<MainWorldFillRequestDetail, "element" | "fieldId" | "vaultlockFieldId">,
): HTMLInputElement | null {
  if (detail.element instanceof HTMLInputElement && detail.element.isConnected) {
    return detail.element;
  }

  if (detail.fieldId) {
    const byId = document.getElementById(detail.fieldId);
    if (byId instanceof HTMLInputElement) {
      return byId;
    }
  }

  if (detail.vaultlockFieldId) {
    return document.querySelector<HTMLInputElement>(
      `input[data-vaultlock-field-id="${detail.vaultlockFieldId}"]`,
    );
  }

  return null;
}

export function requestMainWorldInputFill(
  element: HTMLInputElement,
  value: string,
  options: MainWorldFillRequestOptions = {},
): boolean {
  const detail: MainWorldFillRequestDetail = {
    element,
    fieldId: element.id || undefined,
    vaultlockFieldId: element.dataset.vaultlockFieldId || undefined,
    value,
    nudgeTrustedInput: options.nudgeTrustedInput ?? true,
    preferTypedInsert: options.preferTypedInsert ?? true,
    success: false,
  };

  document.dispatchEvent(
    new CustomEvent<MainWorldFillRequestDetail>(MAIN_WORLD_FILL_REQUEST_EVENT, { detail }),
  );

  return detail.success;
}
