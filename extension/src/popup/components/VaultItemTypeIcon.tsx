import type { VaultItemType } from "@vaultlock/shared/types";
import { cn } from "@vaultlock/ui/lib/utils";
import { CreditCard, KeyRound, NotebookPen } from "lucide-react";

const ICONS: Record<VaultItemType, typeof KeyRound> = {
  login: KeyRound,
  note: NotebookPen,
  card: CreditCard,
};

interface VaultItemTypeIconProps {
  itemType: VaultItemType;
  className?: string;
}

export function VaultItemTypeIcon({ itemType, className }: VaultItemTypeIconProps) {
  const Icon = ICONS[itemType] ?? KeyRound;

  return (
    <div
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
    </div>
  );
}
