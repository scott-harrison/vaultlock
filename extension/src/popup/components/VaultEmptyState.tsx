import { Button } from "@vaultlock/ui/components/ui/button";
import { cn } from "@vaultlock/ui/lib/utils";
import type { LucideIcon } from "lucide-react";

interface VaultEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

export function VaultEmptyState({
  icon: Icon,
  title,
  description,
  className,
}: VaultEmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center px-4 py-8 text-center", className)}>
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </div>
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
