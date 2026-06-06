import { setInputValue } from "../../lib/formFillDom";

function isVisibleField(input: HTMLInputElement): boolean {
  const style = window.getComputedStyle(input);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    input.offsetWidth > 20 &&
    input.offsetHeight > 10 &&
    !input.disabled &&
    !input.readOnly
  );
}

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
