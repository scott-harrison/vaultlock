/** Lock the vault after this much idle time (milliseconds). */
export const AUTO_LOCK_MS = 5 * 60 * 1000;

/** How often to check whether the idle timeout has elapsed. */
export const AUTO_LOCK_CHECK_INTERVAL_MS = 1_000;

/** Intentional user activity — excludes mousemove, which fires constantly and prevents locking. */
export const AUTO_LOCK_ACTIVITY_EVENTS = [
  "click",
  "keydown",
  "input",
  "focusin",
  "mousedown",
  "pointerdown",
  "scroll",
  "touchstart",
  "wheel",
] as const;
