const DEFAULT_MUTATION_DEBOUNCE_MS = 150;
const DEFAULT_INPUT_DEBOUNCE_MS = 120;

const MUTATION_ATTRIBUTE_FILTER = [
  "type",
  "hidden",
  "class",
  "style",
  "aria-hidden",
  "disabled",
  "tabindex",
] as const;

const LOGIN_INPUT_TYPES = new Set(["text", "email", "tel", "password"]);

export type LoginFieldScanFn = () => void;

export type LoginFieldScannerOptions = {
  scan: LoginFieldScanFn;
  isContextValid: () => boolean;
  getObserveTarget?: () => Node | null;
  mutationDebounceMs?: number;
  inputDebounceMs?: number;
  onContextInvalidated?: () => void;
};

export function installSpaNavigationRescanHooks(
  onNavigate: () => void,
  guards?: {
    isActive?: () => boolean;
    onInactive?: () => void;
  },
): () => void {
  const handleNavigate = (): void => {
    if (guards?.isActive && !guards.isActive()) {
      guards.onInactive?.();
      return;
    }
    onNavigate();
  };

  window.addEventListener("popstate", handleNavigate);

  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = (...args: Parameters<History["pushState"]>) => {
    originalPushState(...args);
    handleNavigate();
  };

  history.replaceState = (...args: Parameters<History["replaceState"]>) => {
    originalReplaceState(...args);
    handleNavigate();
  };

  return () => {
    window.removeEventListener("popstate", handleNavigate);
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
  };
}

export function mutationRecordsRequireRescan(records: MutationRecord[]): boolean {
  for (const record of records) {
    if (
      record.type === "childList" &&
      (record.addedNodes.length > 0 || record.removedNodes.length > 0)
    ) {
      return true;
    }

    if (record.type === "attributes" && record.attributeName) {
      const target = record.target as { tagName?: string } | null;
      const name = record.attributeName.toLowerCase();

      if (target?.tagName === "INPUT") {
        return true;
      }

      if (
        name === "class" ||
        name === "style" ||
        name === "hidden" ||
        name === "aria-hidden" ||
        name === "inert"
      ) {
        return true;
      }
    }
  }

  return false;
}

export function createLoginFieldScanner(options: LoginFieldScannerOptions) {
  const mutationDebounceMs = options.mutationDebounceMs ?? DEFAULT_MUTATION_DEBOUNCE_MS;
  const inputDebounceMs = options.inputDebounceMs ?? DEFAULT_INPUT_DEBOUNCE_MS;

  let mutationTimer: ReturnType<typeof setTimeout> | null = null;
  let inputTimer: ReturnType<typeof setTimeout> | null = null;
  let observer: MutationObserver | null = null;
  let spaNavigationCleanup: (() => void) | null = null;
  let started = false;

  const clearMutationTimer = (): void => {
    if (mutationTimer) {
      clearTimeout(mutationTimer);
      mutationTimer = null;
    }
  };

  const clearInputTimer = (): void => {
    if (inputTimer) {
      clearTimeout(inputTimer);
      inputTimer = null;
    }
  };

  const scanNow = (): void => {
    if (!options.isContextValid()) {
      return;
    }
    options.scan();
  };

  const scheduleMutationScan = (): void => {
    clearMutationTimer();
    mutationTimer = setTimeout(() => {
      mutationTimer = null;
      scanNow();
    }, mutationDebounceMs);
  };

  const scheduleInputScan = (): void => {
    clearInputTimer();
    inputTimer = setTimeout(() => {
      inputTimer = null;
      scanNow();
    }, inputDebounceMs);
  };

  const handleContextInvalidated = (): void => {
    stop();
    options.onContextInvalidated?.();
  };

  const start = (): void => {
    if (started) {
      return;
    }
    started = true;

    scanNow();

    const observeTarget = options.getObserveTarget?.() ?? document.body ?? document.documentElement;
    if (!observeTarget) {
      return;
    }

    observer = new MutationObserver((records) => {
      if (!options.isContextValid()) {
        handleContextInvalidated();
        return;
      }

      if (mutationRecordsRequireRescan(records)) {
        scheduleMutationScan();
      }
    });

    observer.observe(observeTarget, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [...MUTATION_ATTRIBUTE_FILTER],
    });

    document.addEventListener(
      "input",
      (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) {
          return;
        }

        if (LOGIN_INPUT_TYPES.has(target.type || "")) {
          scheduleInputScan();
        }
      },
      true,
    );

    document.addEventListener(
      "focusin",
      (event) => {
        if (event.target instanceof HTMLInputElement) {
          scheduleInputScan();
        }
      },
      true,
    );

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        scanNow();
      }
    });

    spaNavigationCleanup = installSpaNavigationRescanHooks(scanNow, {
      isActive: options.isContextValid,
      onInactive: handleContextInvalidated,
    });
  };

  const stop = (): void => {
    started = false;
    clearMutationTimer();
    clearInputTimer();
    observer?.disconnect();
    observer = null;
    spaNavigationCleanup?.();
    spaNavigationCleanup = null;
  };

  return {
    scanNow,
    scheduleMutationScan,
    scheduleInputScan,
    start,
    stop,
  };
}
