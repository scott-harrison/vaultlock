export const VAULTLOCK_DECORATED_FIELD_SELECTOR = 'input[data-vaultlock-action-control="true"]';

export function ensureVaultlockFieldId(field: HTMLInputElement): string {
  if (field.id) {
    return field.id;
  }

  const existing = field.dataset.vaultlockFieldId;
  if (existing) {
    return existing;
  }

  const generated = `vl-field-${crypto.randomUUID()}`;
  field.dataset.vaultlockFieldId = generated;
  return generated;
}

export function buildFillFieldRefs(
  field: HTMLInputElement,
  fieldType: "username" | "password",
): {
  triggerFieldId: string;
  associatedFieldId?: string;
} {
  return {
    triggerFieldId: ensureVaultlockFieldId(field),
    associatedFieldId:
      fieldType === "password"
        ? field.dataset.vaultlockAssociatedUsernameId || undefined
        : undefined,
  };
}
