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

function dispatchInputLifecycleEvents(
  element: ValueCapableElement,
  value: string,
  inputType: "insertText" | "insertFromPaste" = "insertText",
): void {
  const beforeInput = new InputEvent("beforeinput", {
    bubbles: true,
    cancelable: true,
    inputType,
    data: value,
  });
  element.dispatchEvent(beforeInput);

  const input = new InputEvent("input", {
    bubbles: true,
    cancelable: true,
    inputType,
    data: value,
  });
  element.dispatchEvent(input);

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

function tryExecCommandInsert(element: ValueCapableElement, value: string): boolean {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    return false;
  }

  try {
    element.focus({ preventScroll: true });
    element.select();
    return document.execCommand("insertText", false, value);
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

/**
 * Sets an input value in a way that reactive frameworks (React, Vue, Apple ID, etc.)
 * treat as user input so validators and submit buttons update.
 */
export function setInputValue(element: HTMLInputElement, value: string): void {
  if (element.value === value) {
    element.focus({ preventScroll: true });
    dispatchInputLifecycleEvents(element, value);
    element.blur();
    return;
  }

  element.focus({ preventScroll: true });

  const insertedViaExecCommand = tryExecCommandInsert(element, value);
  if (!insertedViaExecCommand) {
    simulateTypedInput(element, value);
  }

  dispatchInputLifecycleEvents(
    element,
    value,
    insertedViaExecCommand ? "insertFromPaste" : "insertText",
  );
  element.blur();
}
