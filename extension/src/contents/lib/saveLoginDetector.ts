import { isExtensionContextValid } from "../../lib/extensionContext";
import { captureLoginFromForm } from "../../lib/formFillDom";
import { maybeShowSaveLoginPrompt } from "./saveLoginPrompt";

function clearSkipSaveOnUserInput(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.dataset.vaultlockSkipSave === "1") {
    delete target.dataset.vaultlockSkipSave;
  }
}

async function handleFormSubmit(event: Event): Promise<void> {
  if (!isExtensionContextValid()) {
    return;
  }

  const form = event.target;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const capture = captureLoginFromForm(form);
  if (!capture) {
    return;
  }

  await maybeShowSaveLoginPrompt(capture);
}

export function initSaveLoginDetection(): void {
  document.addEventListener(
    "submit",
    (event) => {
      void handleFormSubmit(event);
    },
    true,
  );

  document.addEventListener(
    "input",
    (event) => {
      clearSkipSaveOnUserInput(event);
    },
    true,
  );
}
