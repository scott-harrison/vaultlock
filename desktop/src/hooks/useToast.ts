import { useCallback, useRef, useState } from "react";

export type ToastVariant = "default" | "success" | "error";

export interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
}

const TOAST_DURATION_MS = 4000;

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
    }
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = "default") => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, variant, message }]);
      const timer = setTimeout(() => dismiss(id), TOAST_DURATION_MS);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  return { toasts, toast, dismiss };
}
