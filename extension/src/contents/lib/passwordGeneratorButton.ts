import {
  DEFAULT_PASSWORD_GENERATOR_OPTIONS,
  MAX_GENERATED_LENGTH,
  MIN_GENERATED_LENGTH,
  type PasswordGeneratorOptions,
  generatePassword,
} from "@vaultlock/shared";
import { markControl } from "./fieldWrapper";
import { fillGeneratedPassword } from "./passwordGeneratorFill";
import { createThemedShadowHost } from "./themedShadowHost";

const GENERATOR_ATTR = "data-vaultlock-generator";

export function injectPasswordGeneratorButton(
  field: HTMLInputElement,
  actionsHost: HTMLElement,
): void {
  if (field.dataset.vaultlockGenerator) {
    return;
  }
  field.dataset.vaultlockGenerator = "true";

  const { host, root } = createThemedShadowHost();
  root.classList.add("vl-host-relative");
  markControl(host);

  let options: PasswordGeneratorOptions = { ...DEFAULT_PASSWORD_GENERATOR_OPTIONS };
  let previewPassword = generatePassword(options);

  const generateButton = document.createElement("button");
  generateButton.type = "button";
  generateButton.className = "vl-btn vl-btn-primary";
  generateButton.textContent = "Generate";
  generateButton.title = "Generate a strong password and fill this field";

  const optionsButton = document.createElement("button");
  optionsButton.type = "button";
  optionsButton.className = "vl-btn vl-btn-icon";
  optionsButton.textContent = "▾";
  optionsButton.title = "Generator options";
  optionsButton.setAttribute("aria-label", "Generator options");

  const popover = document.createElement("div");
  popover.className = "vl-popover";
  popover.hidden = true;

  const title = document.createElement("p");
  title.className = "vl-popover-title";
  title.textContent = "Password generator";

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
    refreshPreview();
  });
  const numbersToggle = createToggle("0-9", options.numbers, (checked) => {
    options = { ...options, numbers: checked };
    refreshPreview();
  });
  const symbolsToggle = createToggle("!@#", options.symbols, (checked) => {
    options = { ...options, symbols: checked };
    refreshPreview();
  });

  toggles.append(uppercaseToggle, numbersToggle, symbolsToggle);

  const actionRow = document.createElement("div");
  actionRow.className = "vl-actions";

  const regenerateButton = document.createElement("button");
  regenerateButton.type = "button";
  regenerateButton.className = "vl-btn";
  regenerateButton.textContent = "Regenerate";

  const fillButton = document.createElement("button");
  fillButton.type = "button";
  fillButton.className = "vl-btn vl-btn-primary";
  fillButton.textContent = "Fill";

  actionRow.append(regenerateButton, fillButton);
  popover.append(title, lengthField, toggles, actionRow);

  const buttonRow = document.createElement("div");
  buttonRow.style.display = "inline-flex";
  buttonRow.style.gap = "2px";
  buttonRow.append(generateButton, optionsButton);
  root.append(buttonRow, popover);

  const closePopover = () => {
    popover.hidden = true;
  };

  const refreshPreview = () => {
    previewPassword = generatePassword(options);
    lengthLabel.textContent = `Length: ${options.length}`;
  };

  generateButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    refreshPreview();
    fillGeneratedPassword(field, previewPassword);
    closePopover();
  });

  optionsButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    popover.hidden = !popover.hidden;
    if (!popover.hidden) {
      refreshPreview();
    }
  });

  lengthInput.addEventListener("input", () => {
    options = { ...options, length: Number(lengthInput.value) };
    refreshPreview();
  });

  regenerateButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    refreshPreview();
  });

  fillButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    fillGeneratedPassword(field, previewPassword);
    closePopover();
  });

  document.addEventListener(
    "click",
    (event) => {
      if (popover.hidden) {
        return;
      }
      const path = event.composedPath();
      if (!path.includes(host)) {
        closePopover();
      }
    },
    true,
  );

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePopover();
    }
  });

  actionsHost.prepend(host);
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
