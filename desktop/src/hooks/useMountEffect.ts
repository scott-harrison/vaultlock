import { useEffect } from "react";

/** Mount-only effect (see repo no-use-effect skill). */
export function useMountEffect(effect: () => (() => void) | undefined) {
  useEffect(effect, []);
}
