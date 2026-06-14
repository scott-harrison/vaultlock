import { tryFrameworkControlledFill } from "./frameworkInputBridge";

type ValueCapableElement = HTMLInputElement | HTMLTextAreaElement;

function valuePrototype(element: ValueCapableElement): HTMLInputElement | HTMLTextAreaElement {
  return element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
}

function nativeValueSetter(element: ValueCapableElement): ((value: string) => void) | null {
  const own = Object.getOwnPropertyDescriptor(element, "value")?.set;
  const inherited = Object.getOwnPropertyDescriptor(valuePrototype(element), "value")?.set;

  if (inherited && own !== inherited) {
    return (value: string) => inherited.call(element, value);
  }

  if (own) {
    return (value: string) => own.call(element, value);
  }

  return inherited ? (value: string) => inherited.call(element, value) : null;
}

function resetReactValueTracker(element: ValueCapableElement): void {
  const tracker = (
    element as ValueCapableElement & { _valueTracker?: { setValue: (value: string) => void } }
  )._valueTracker;

  if (tracker) {
    tracker.setValue(element.value);
  }
}

export function dispatchInputLifecycleEvents(
  element: ValueCapableElement,
  value: string,
  inputType: "insertText" | "insertFromPaste" = "insertText",
): void {
  element.dispatchEvent(
    new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType,
      data: value,
    }),
  );

  element.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType,
      data: value,
    }),
  );

  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Unidentified" }));
  element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Unidentified" }));

  element.form?.dispatchEvent(new Event("input", { bubbles: true }));
  element.form?.dispatchEvent(new Event("change", { bubbles: true }));
}

function assignValue(element: ValueCapableElement, value: string): void {
  const setter = nativeValueSetter(element);
  if (!setter) {
    element.value = value;
    return;
  }

  resetReactValueTracker(element);
  setter(value);
}

function clearFieldForExecCommand(element: ValueCapableElement): void {
  element.focus({ preventScroll: true });
  element.select();
  document.execCommand("delete", false);
  assignValue(element, "");
}

function tryExecCommandTypedInsert(element: ValueCapableElement, value: string): boolean {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    return false;
  }

  try {
    clearFieldForExecCommand(element);

    for (const char of value) {
      if (!document.execCommand("insertText", false, char)) {
        return false;
      }
    }

    return element.value === value;
  } catch {
    return false;
  }
}

function tryExecCommandInsert(element: ValueCapableElement, value: string): boolean {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    return false;
  }

  try {
    clearFieldForExecCommand(element);
    return document.execCommand("insertText", false, value) && element.value === value;
  } catch {
    return false;
  }
}

function simulateTypedInput(element: ValueCapableElement, value: string): void {
  assignValue(element, "");

  for (const char of value) {
    const nextValue = `${element.value}${char}`;
    resetReactValueTracker(element);
    assignValue(element, nextValue);
    element.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        inputType: "insertText",
        data: char,
      }),
    );
  }
}

function tryTrustedValueInsert(
  element: HTMLInputElement,
  value: string,
  preferTypedInsert: boolean,
): boolean {
  const insertedViaTypedExecCommand = preferTypedInsert
    ? tryExecCommandTypedInsert(element, value)
    : false;

  return insertedViaTypedExecCommand || tryExecCommandInsert(element, value);
}

function syncFrameworkInputState(element: HTMLInputElement, value: string): void {
  if (element.value !== value) {
    return;
  }

  tryFrameworkControlledFill(element, value);
}

/**
 * Mimics a trusted space-then-backspace edit so validators that ignore
 * programmatic fills (Apple ID, etc.) re-run against the filled value.
 */
function setCaretPosition(element: HTMLInputElement, start: number, end = start): boolean {
  try {
    element.setSelectionRange(start, end);
    return true;
  } catch {
    return false;
  }
}

export function nudgeTrustedInputValidation(element: HTMLInputElement): void {
  const expectedValue = element.value;

  element.focus({ preventScroll: true });

  if (!setCaretPosition(element, expectedValue.length)) {
    return;
  }

  if (!document.execCommand("insertText", false, " ")) {
    return;
  }

  if (!setCaretPosition(element, expectedValue.length, expectedValue.length + 1)) {
    document.execCommand("delete", false);
    if (element.value !== expectedValue) {
      assignValue(element, expectedValue);
      dispatchInputLifecycleEvents(element, expectedValue);
    }
    return;
  }

  document.execCommand("delete", false);

  if (element.value !== expectedValue) {
    assignValue(element, expectedValue);
    dispatchInputLifecycleEvents(element, expectedValue);
  }
}

export interface SetInputValueInPageContextOptions {
  nudgeTrustedInput?: boolean;
  preferTypedInsert?: boolean;
}

/**
 * Page-context (MAIN world) input fill. Prefer execCommand so frameworks
 * receive trusted input events where the browser allows it.
 */
export function setInputValueInPageContext(
  element: HTMLInputElement,
  value: string,
  options: SetInputValueInPageContextOptions = {},
): void {
  const nudgeTrustedInput = options.nudgeTrustedInput ?? true;
  const preferTypedInsert = options.preferTypedInsert ?? true;

  element.focus({ preventScroll: true });

  if (element.value !== value) {
    const insertedViaExecCommand = tryTrustedValueInsert(element, value, preferTypedInsert);

    if (!insertedViaExecCommand) {
      if (!tryFrameworkControlledFill(element, value)) {
        simulateTypedInput(element, value);
        dispatchInputLifecycleEvents(element, value);
      }
    }
  }

  syncFrameworkInputState(element, value);

  if (nudgeTrustedInput) {
    nudgeTrustedInputValidation(element);
    return;
  }

  element.blur();
}
