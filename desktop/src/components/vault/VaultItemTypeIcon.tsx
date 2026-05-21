import { cn } from "@/lib/utils";
import type { VaultItemType } from "@vaultlock/shared/types";
import { CreditCard, KeyRound, NotebookPen } from "lucide-react";

const ICONS: Record<VaultItemType, typeof KeyRound> = {
  login: KeyRound,
  note: NotebookPen,
  card: CreditCard,
};

interface VaultItemTypeIconProps {
  itemType: VaultItemType;
  className?: string;
  iconClassName?: string;
}

export function VaultItemTypeIcon({
  itemType,
  className,
  iconClassName = "size-4",
}: VaultItemTypeIconProps) {
  const Icon = ICONS[itemType] ?? KeyRound;

  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground",
        className,
      )}
    >
      <Icon className={iconClassName} aria-hidden />
    </div>
  );
}
