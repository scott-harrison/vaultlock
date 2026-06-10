export const MAIN_WORLD_FILL_REQUEST_EVENT = "vaultlock:main-world-fill-request";

export interface MainWorldFillRequestDetail {
  fieldId?: string;
  vaultlockFieldId?: string;
  value: string;
  nudgeTrustedInput: boolean;
  success: boolean;
}

export interface MainWorldFillRequestOptions {
  nudgeTrustedInput?: boolean;
}

export function resolveMainWorldFillTarget(
  detail: Pick<MainWorldFillRequestDetail, "fieldId" | "vaultlockFieldId">,
): HTMLInputElement | null {
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
    fieldId: element.id || undefined,
    vaultlockFieldId: element.dataset.vaultlockFieldId || undefined,
    value,
    nudgeTrustedInput: options.nudgeTrustedInput ?? true,
    success: false,
  };

  document.dispatchEvent(
    new CustomEvent<MainWorldFillRequestDetail>(MAIN_WORLD_FILL_REQUEST_EVENT, { detail }),
  );

  return detail.success;
}
