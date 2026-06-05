import { Button } from "@vaultlock/ui/components/ui/button";
import { cn } from "@vaultlock/ui/lib/utils";
import type { LucideIcon } from "lucide-react";

interface VaultEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function VaultEmptyState({
  icon: Icon,
  title,
  description,
  className,
  action,
}: VaultEmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-10 text-center", className)}>
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" aria-hidden />
      </div>
      <h3 className="mt-4 text-sm font-semibold">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>
      {action && (
        <Button type="button" size="sm" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
