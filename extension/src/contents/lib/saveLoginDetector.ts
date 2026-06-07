import { isExtensionContextValid } from "../../lib/extensionContext";
import {
  captureLoginFromForm,
  captureLoginFromPasswordField,
  captureLoginNearElement,
} from "../../lib/formFillDom";
import { findClickedSubmitControl, isSubmitLikeControl } from "../../lib/saveLoginHeuristics";
import { maybeShowSaveLoginPrompt } from "./saveLoginPrompt";

const PROMPT_DEBOUNCE_MS = 2500;
let lastPromptKey = "";
let lastPromptAt = 0;

function clearSkipSaveOnUserInput(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.dataset.vaultlockSkipSave === "1") {
    delete target.dataset.vaultlockSkipSave;
  }
}

function shouldDebouncePrompt(capture: { username: string; password: string }): boolean {
  const key = `${capture.username}\u0000${capture.password}`;
  const now = Date.now();
  if (key === lastPromptKey && now - lastPromptAt < PROMPT_DEBOUNCE_MS) {
    return true;
  }

  lastPromptKey = key;
  lastPromptAt = now;
  return false;
}

async function offerSavePrompt(
  capture: { username: string; password: string } | null,
): Promise<void> {
  if (!capture || shouldDebouncePrompt(capture)) {
    return;
  }

  await maybeShowSaveLoginPrompt(capture);
}

async function handleFormSubmit(event: Event): Promise<void> {
  if (!isExtensionContextValid()) {
    return;
  }

  const form = event.target;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  await offerSavePrompt(captureLoginFromForm(form));
}

async function handleSubmitControlClick(event: Event): Promise<void> {
  if (!isExtensionContextValid()) {
    return;
  }

  const control = findClickedSubmitControl(event.target);
  if (!control) {
    return;
  }

  const form = control.closest("form");
  if (form) {
    await offerSavePrompt(captureLoginFromForm(form));
    return;
  }

  if (!isSubmitLikeControl(control)) {
    return;
  }

  await offerSavePrompt(captureLoginNearElement(control));
}

async function handlePasswordEnter(event: KeyboardEvent): Promise<void> {
  if (!isExtensionContextValid() || event.key !== "Enter") {
    return;
  }

  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  const autocomplete = (target.autocomplete || "").toLowerCase();
  const isPasswordInput =
    target.type === "password" ||
    autocomplete === "new-password" ||
    autocomplete === "current-password";

  if (!isPasswordInput) {
    return;
  }

  await offerSavePrompt(captureLoginFromPasswordField(target));
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
    "click",
    (event) => {
      void handleSubmitControlClick(event);
    },
    true,
  );

  document.addEventListener(
    "keydown",
    (event) => {
      void handlePasswordEnter(event);
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
