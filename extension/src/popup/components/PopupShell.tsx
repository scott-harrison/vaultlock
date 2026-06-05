import { cn } from "@vaultlock/ui/lib/utils";

interface PopupShellProps {
  children: React.ReactNode;
  className?: string;
}

export function PopupShell({ children, className }: PopupShellProps) {
  return (
    <div className={cn("w-[320px] min-h-[200px] bg-background p-4 text-foreground", className)}>
      {children}
    </div>
  );
}
