import { isVisibleField } from "../../lib/fieldVisibility";
import { setInputValue } from "../../lib/formFillDom";

export function fillGeneratedPassword(targetField: HTMLInputElement, password: string): void {
  setInputValue(targetField, password);

  const form = targetField.closest("form");
  if (!form) {
    return;
  }

  const passwordFields = Array.from(
    form.querySelectorAll<HTMLInputElement>('input[type="password"]'),
  ).filter(isVisibleField);

  for (const field of passwordFields) {
    if (field === targetField) {
      continue;
    }
    if (!field.value.trim()) {
      setInputValue(field, password);
    }
  }
}
