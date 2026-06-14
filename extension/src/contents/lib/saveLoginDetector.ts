import { isExtensionContextValid } from "../../lib/extensionContext";
import {
  captureLoginFromForm,
  captureLoginFromPasswordField,
  captureLoginNearElement,
} from "../../lib/formFillDom";
import { enrichCapturedLogin, trackLoginFieldInput } from "../../lib/loginCaptureState";
import { findClickedSubmitControl, isSubmitLikeControl } from "../../lib/saveLoginHeuristics";
import { maybeShowSaveLoginPrompt } from "./saveLoginPrompt";

interface CaptureContext {
  anchor: Element;
  submitControl?: Element;
}

const PROMPT_DEBOUNCE_MS = 2500;
const CAPTURE_RETRY_DELAYS_MS = [0, 100, 250, 500] as const;

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

  trackLoginFieldInput(event);
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
  context: CaptureContext,
): Promise<void> {
  const enriched = await enrichCapturedLogin(capture);
  if (!enriched || shouldDebouncePrompt(enriched)) {
    return;
  }

  await maybeShowSaveLoginPrompt(enriched);
}

function scheduleCaptureAttempts(
  collect: () => { username: string; password: string } | null,
  context: CaptureContext,
): void {
  for (const delay of CAPTURE_RETRY_DELAYS_MS) {
    setTimeout(() => {
      if (!isExtensionContextValid()) {
        return;
      }

      void offerSavePrompt(collect(), context);
    }, delay);
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

  const submitter = (event as SubmitEvent).submitter;
  const submitControl = submitter instanceof Element ? submitter : undefined;

  scheduleCaptureAttempts(() => captureLoginFromForm(form), {
    anchor: form,
    submitControl,
  });
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
    const shouldCapture =
      control instanceof HTMLInputElement ||
      control instanceof HTMLButtonElement ||
      isSubmitLikeControl(control);

    if (!shouldCapture) {
      return;
    }

    scheduleCaptureAttempts(() => captureLoginFromForm(form), {
      anchor: form,
      submitControl: control,
    });
    return;
  }

  if (!isSubmitLikeControl(control)) {
    return;
  }

  scheduleCaptureAttempts(() => captureLoginNearElement(control), {
    anchor: control,
    submitControl: control,
  });
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

  scheduleCaptureAttempts(() => captureLoginFromPasswordField(target), { anchor: target });
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

  document.addEventListener(
    "change",
    (event) => {
      clearSkipSaveOnUserInput(event);
    },
    true,
  );
}
