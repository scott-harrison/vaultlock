import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef } from "react";
import {
  AUTO_LOCK_ACTIVITY_EVENTS,
  AUTO_LOCK_CHECK_INTERVAL_MS,
  AUTO_LOCK_MS,
} from "../lib/autoLock";

interface UseAutoLockOptions {
  enabled: boolean;
  onLock: () => void;
  timeoutMs?: number;
}

/** Locks the vault after a period without pointer or keyboard activity. */
export function useAutoLock({
  enabled,
  onLock,
  timeoutMs = AUTO_LOCK_MS,
}: UseAutoLockOptions): void {
  const onLockRef = useRef(onLock);
  onLockRef.current = onLock;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let lastActivityAt = Date.now();
    let locked = false;

    const lock = () => {
      if (locked) {
        return;
      }
      locked = true;
      onLockRef.current();
    };

    const bumpActivity = () => {
      lastActivityAt = Date.now();
    };

    const checkIdle = () => {
      if (Date.now() - lastActivityAt >= timeoutMs) {
        lock();
      }
    };

    const activityOptions: AddEventListenerOptions = { capture: true, passive: true };
    for (const eventName of AUTO_LOCK_ACTIVITY_EVENTS) {
      document.addEventListener(eventName, bumpActivity, activityOptions);
    }

    document.addEventListener("visibilitychange", checkIdle);

    const intervalId = setInterval(checkIdle, AUTO_LOCK_CHECK_INTERVAL_MS);

    let unlistenFocus: (() => void) | undefined;
    void getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (focused) {
          checkIdle();
        }
      })
      .then((unlisten) => {
        unlistenFocus = unlisten;
      })
      .catch(() => {
        // Outside the Tauri runtime (e.g. Vite-only preview).
      });

    return () => {
      clearInterval(intervalId);
      for (const eventName of AUTO_LOCK_ACTIVITY_EVENTS) {
        document.removeEventListener(eventName, bumpActivity, activityOptions);
      }
      document.removeEventListener("visibilitychange", checkIdle);
      unlistenFocus?.();
    };
  }, [enabled, timeoutMs]);
}
