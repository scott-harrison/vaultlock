import { Button } from "@/components/ui/button";
import type { ToastItem } from "@/hooks/useToast";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

interface ToasterProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

const variantStyles: Record<ToastItem["variant"], string> = {
  default: "border-border bg-card text-card-foreground",
  success: "border-primary/30 bg-card text-card-foreground",
  error: "border-destructive/40 bg-card text-card-foreground",
};

function ToastIcon({ variant }: { variant: ToastItem["variant"] }) {
  if (variant === "success") {
    return <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden />;
  }
  if (variant === "error") {
    return <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden />;
  }
  return null;
}

export function Toaster({ toasts, onDismiss }: ToasterProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-2"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg animate-in fade-in-0 slide-in-from-bottom-2",
            variantStyles[toast.variant],
          )}
        >
          <ToastIcon variant={toast.variant} />
          <p className="min-w-0 flex-1 leading-snug">{toast.message}</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            aria-label="Dismiss"
            onClick={() => onDismiss(toast.id)}
          >
            <X className="size-3.5" aria-hidden />
          </Button>
        </div>
      ))}
    </div>
  );
}
