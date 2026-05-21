import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  type DecryptedVaultItem,
  vaultItemDisplaySubtitle,
  vaultItemDisplayTitle,
} from "@/lib/vaultItems";
import type { VaultItemType } from "@vaultlock/shared/types";
import { KeyRound, NotebookPen, Search } from "lucide-react";

interface VaultItemListProps {
  items: DecryptedVaultItem[];
  selectedItemId: string | null;
  searchQuery: string;
  isLoading: boolean;
  isSyncing?: boolean;
  sectionLabel: string;
  onSearchChange: (query: string) => void;
  onSelectItem: (itemId: string) => void;
  onSync: () => void;
}

function ItemIcon({ itemType }: { itemType: VaultItemType }) {
  const Icon = itemType === "note" ? NotebookPen : KeyRound;
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <Icon className="size-4" aria-hidden />
    </div>
  );
}

export function VaultItemList({
  items,
  selectedItemId,
  searchQuery,
  isLoading,
  isSyncing = false,
  sectionLabel,
  onSearchChange,
  onSelectItem,
  onSync,
}: VaultItemListProps) {
  return (
    <section className="flex h-full w-80 shrink-0 flex-col border-r border-border bg-card/40">
      <div className="space-y-3 border-b border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{sectionLabel}</h2>
          <button
            type="button"
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            disabled={isLoading || isSyncing}
            onClick={onSync}
          >
            {isSyncing ? "Syncing…" : "Sync"}
          </button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search…"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading items…</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            {searchQuery.trim() ? "No items match your search." : "No items yet."}
          </p>
        ) : (
          <ul className="space-y-1 p-2">
            {items.map((item) => {
              const isSelected = item.id === selectedItemId;
              const subtitle = vaultItemDisplaySubtitle(item);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent hover:text-accent-foreground",
                    )}
                    onClick={() => onSelectItem(item.id)}
                  >
                    <ItemIcon itemType={item.itemType} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {vaultItemDisplayTitle(item)}
                      </div>
                      {subtitle && (
                        <div
                          className={cn(
                            "truncate text-xs",
                            isSelected ? "text-primary-foreground/80" : "text-muted-foreground",
                          )}
                        >
                          {subtitle}
                        </div>
                      )}
                    </div>
                    {!isSelected && (
                      <Badge variant="outline" className="shrink-0 capitalize">
                        {item.itemType}
                      </Badge>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </section>
  );
}
