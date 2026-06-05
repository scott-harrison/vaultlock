import { cn } from "@vaultlock/ui/lib/utils";

interface AuthFeedbackProps {
  variant: "error" | "success" | "warning";
  children: React.ReactNode;
  className?: string;
}

const variantClassName: Record<AuthFeedbackProps["variant"], string> = {
  error: "text-destructive",
  success: "text-primary",
  warning: "text-amber-600 dark:text-amber-400",
};

export function AuthFeedback({ variant, children, className }: AuthFeedbackProps) {
  return <p className={cn("text-xs", variantClassName[variant], className)}>{children}</p>;
}
