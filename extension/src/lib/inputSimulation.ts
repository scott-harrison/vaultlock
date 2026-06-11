import { dispatchInputLifecycleEvents, setInputValueInPageContext } from "./inputSimulationCore";
import { requestMainWorldInputFill } from "./mainWorldFillBridge";

/**
 * Sets an input value in a way that reactive frameworks (React, Vue, Apple ID, etc.)
 * treat as user input so validators and submit buttons update.
 *
 * Delegates to the MAIN-world fill bridge first so page scripts receive trusted
 * input where possible; falls back to isolated-world simulation.
 */
export function setInputValue(element: HTMLInputElement, value: string): void {
  if (requestMainWorldInputFill(element, value)) {
    return;
  }

  setInputValueInPageContext(element, value, { nudgeTrustedInput: true });
}

export { dispatchInputLifecycleEvents };
