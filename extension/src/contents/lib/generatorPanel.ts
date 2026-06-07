import {
  DEFAULT_PASSWORD_GENERATOR_OPTIONS,
  MAX_GENERATED_LENGTH,
  MIN_GENERATED_LENGTH,
  type PasswordGeneratorOptions,
  generatePassword,
} from "@vaultlock/shared";

export interface GeneratorPanel {
  element: HTMLElement;
  getPassword: () => string;
  refresh: () => void;
}

export function createGeneratorPanel(): GeneratorPanel {
  let options: PasswordGeneratorOptions = { ...DEFAULT_PASSWORD_GENERATOR_OPTIONS };
  let previewPassword = generatePassword(options);

  const panel = document.createElement("div");
  panel.className = "vl-generator";

  const lengthField = document.createElement("div");
  lengthField.className = "vl-field";

  const lengthLabel = document.createElement("label");
  lengthLabel.className = "vl-label";
  lengthLabel.textContent = `Length: ${options.length}`;

  const lengthInput = document.createElement("input");
  lengthInput.type = "range";
  lengthInput.className = "vl-range";
  lengthInput.min = String(MIN_GENERATED_LENGTH);
  lengthInput.max = String(MAX_GENERATED_LENGTH);
  lengthInput.value = String(options.length);

  lengthField.append(lengthLabel, lengthInput);

  const toggles = document.createElement("div");
  toggles.className = "vl-toggles";

  const uppercaseToggle = createToggle("A-Z", options.uppercase, (checked) => {
    options = { ...options, uppercase: checked };
    refresh();
  });
  const numbersToggle = createToggle("0-9", options.numbers, (checked) => {
    options = { ...options, numbers: checked };
    refresh();
  });
  const symbolsToggle = createToggle("!@#", options.symbols, (checked) => {
    options = { ...options, symbols: checked };
    refresh();
  });

  toggles.append(uppercaseToggle, numbersToggle, symbolsToggle);

  const preview = document.createElement("p");
  preview.className = "vl-generator-preview";
  preview.textContent = previewPassword;

  const actionRow = document.createElement("div");
  actionRow.className = "vl-actions";

  const regenerateButton = document.createElement("button");
  regenerateButton.type = "button";
  regenerateButton.className = "vl-btn";
  regenerateButton.textContent = "Regenerate";

  const useButton = document.createElement("button");
  useButton.type = "button";
  useButton.className = "vl-btn vl-btn-primary";
  useButton.textContent = "Use password";

  actionRow.append(regenerateButton, useButton);
  panel.append(lengthField, toggles, preview, actionRow);

  function refresh(): void {
    previewPassword = generatePassword(options);
    lengthLabel.textContent = `Length: ${options.length}`;
    preview.textContent = previewPassword;
  }

  lengthInput.addEventListener("input", () => {
    options = { ...options, length: Number(lengthInput.value) };
    refresh();
  });

  regenerateButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    refresh();
  });

  return {
    element: panel,
    getPassword: () => previewPassword,
    refresh,
  };
}

function createToggle(
  label: string,
  checked: boolean,
  onChange: (checked: boolean) => void,
): HTMLLabelElement {
  const toggle = document.createElement("label");
  toggle.className = "vl-toggle";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;

  input.addEventListener("change", () => {
    onChange(input.checked);
  });

  toggle.append(input, document.createTextNode(label));
  return toggle;
}

export function generateDefaultPassword(): string {
  return generatePassword(DEFAULT_PASSWORD_GENERATOR_OPTIONS);
}
