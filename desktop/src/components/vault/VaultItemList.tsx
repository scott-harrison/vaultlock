import { VaultEmptyState } from "@/components/vault/VaultEmptyState";
import { VaultItemTypeIcon } from "@/components/vault/VaultItemTypeIcon";
import { VaultListSkeleton } from "@/components/vault/VaultListSkeleton";
import {
  type DecryptedVaultItem,
  vaultItemDisplaySubtitle,
  vaultItemDisplayTitle,
} from "@/lib/vaultItems";
import type { VaultItemType } from "@vaultlock/shared/types";
import { Button } from "@vaultlock/ui/components/ui/button";
import { Input } from "@vaultlock/ui/components/ui/input";
import { ScrollArea } from "@vaultlock/ui/components/ui/scroll-area";
import { cn } from "@vaultlock/ui/lib/utils";
import { KeyRound, NotebookPen, RefreshCw, Search } from "lucide-react";

interface VaultItemListProps {
  items: DecryptedVaultItem[];
  selectedItemId: string | null;
  searchQuery: string;
  isLoading: boolean;
  isSyncing?: boolean;
  sectionLabel: string;
  sectionItemType?: VaultItemType;
  onSearchChange: (query: string) => void;
  onSelectItem: (itemId: string) => void;
  onSync: () => void;
  onAddItem?: () => void;
}

export function VaultItemList({
  items,
  selectedItemId,
  searchQuery,
  isLoading,
  isSyncing = false,
  sectionLabel,
  sectionItemType,
  onSearchChange,
  onSelectItem,
  onSync,
  onAddItem,
}: VaultItemListProps) {
  const isSearchEmpty = searchQuery.trim().length > 0;
  const canAdd = Boolean(onAddItem && sectionItemType);

  return (
    <section className="flex h-full w-80 shrink-0 flex-col border-r border-border bg-card/40">
      <div className="space-y-3 border-b border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{sectionLabel}</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            disabled={isLoading || isSyncing}
            onClick={onSync}
          >
            <RefreshCw className={cn("size-3.5", isSyncing && "animate-spin")} aria-hidden />
            {isSyncing ? "Syncing…" : "Sync"}
          </Button>
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
          <VaultListSkeleton />
        ) : items.length === 0 ? (
          isSearchEmpty ? (
            <VaultEmptyState
              className="py-12"
              icon={Search}
              title="No matches"
              description="Try a different search term or clear the filter."
            />
          ) : (
            <VaultEmptyState
              className="py-12"
              icon={sectionItemType === "note" ? NotebookPen : KeyRound}
              title={`No ${sectionLabel.toLowerCase()} yet`}
              description={
                canAdd
                  ? `Create your first ${sectionItemType === "note" ? "note" : "login"} to get started.`
                  : "Items you add will appear here."
              }
              action={
                canAdd && onAddItem
                  ? {
                      label: "New item",
                      onClick: onAddItem,
                    }
                  : undefined
              }
            />
          )
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
                    <VaultItemTypeIcon
                      itemType={item.itemType}
                      className={cn(
                        isSelected && "bg-primary-foreground/15 text-primary-foreground",
                      )}
                    />
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
