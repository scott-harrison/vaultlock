import { cn } from "@/lib/utils";

interface AuthFeedbackProps {
  variant: "error" | "success" | "warning";
  children: React.ReactNode;
}

const variantClassName: Record<AuthFeedbackProps["variant"], string> = {
  error: "text-destructive",
  success: "text-primary",
  warning: "text-amber-500 dark:text-amber-400",
};

export function AuthFeedback({ variant, children }: AuthFeedbackProps) {
  return <p className={cn("text-sm", variantClassName[variant])}>{children}</p>;
}
