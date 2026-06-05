import type { LoginItemPlaintext } from "@vaultlock/shared/types";
import { Button } from "@vaultlock/ui/components/ui/button";
import { Input } from "@vaultlock/ui/components/ui/input";
import { ScrollArea } from "@vaultlock/ui/components/ui/scroll-area";
import { cn } from "@vaultlock/ui/lib/utils";
import { KeyRound, LogOut, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import type { AutofillRequest } from "../../lib/messaging";
import { useVaultList } from "../hooks/useVaultList";
import { formatRelativeTime } from "../utils/formatRelativeTime";
import { AuthFeedback } from "./AuthFeedback";
import { VaultEmptyState } from "./VaultEmptyState";
import { VaultListItem } from "./VaultListItem";
import { VaultListSkeleton } from "./VaultListSkeleton";

interface VaultListViewProps {
  pendingFillRequest: AutofillRequest | null;
  onLock: (clearItems: () => void) => void | Promise<void>;
  onLogout: (clearItems: () => void) => void | Promise<void>;
  onFillComplete: () => void;
}

export function VaultListView({
  pendingFillRequest,
  onLock,
  onLogout,
  onFillComplete,
}: VaultListViewProps) {
  const {
    items,
    search,
    setSearch,
    loading,
    error,
    fillError,
    fillingId,
    lastSynced,
    isSyncing,
    refreshFromServer,
    handleFill,
    clearItems,
  } = useVaultList(pendingFillRequest);

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, fieldKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 1200);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  const isSearchActive = search.trim().length > 0;

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card/40">
      <div className="space-y-3 border-b border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Vault</h2>
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              disabled={loading || isSyncing}
              onClick={() => refreshFromServer(false)}
            >
              <RefreshCw className={cn("size-3.5", isSyncing && "animate-spin")} aria-hidden />
              {isSyncing ? "Syncing…" : "Sync"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onLock(clearItems)}
            >
              Lock
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              aria-label="Sign out"
              onClick={() => onLogout(clearItems)}
            >
              <LogOut className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="pl-9"
            placeholder="Search…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {lastSynced ? (
          <p className="text-xs text-muted-foreground">
            Last synced {formatRelativeTime(lastSynced)}
          </p>
        ) : null}

        {error ? (
          <AuthFeedback variant="error" className="whitespace-pre-line">
            {error}
          </AuthFeedback>
        ) : null}
        {fillError ? <AuthFeedback variant="error">{fillError}</AuthFeedback> : null}
      </div>

      <ScrollArea className="h-[280px]">
        {loading ? (
          <VaultListSkeleton />
        ) : items.length === 0 && !error ? (
          isSearchActive ? (
            <VaultEmptyState
              className="py-12"
              icon={Search}
              title="No matches"
              description="Try a different search term or clear the filter."
            />
          ) : (
            <VaultEmptyState
              className="py-12"
              icon={KeyRound}
              title="No items yet"
              description="Items you add will appear here."
            />
          )
        ) : (
          <ul className="space-y-1 p-2">
            {items.map((item) => (
              <VaultListItem
                key={item.id}
                item={item}
                showFill={Boolean(pendingFillRequest && item.itemType === "login")}
                isFilling={fillingId === item.id}
                copiedField={copiedField}
                onCopy={copyToClipboard}
                onFill={() =>
                  handleFill(item.plaintext as LoginItemPlaintext, item.id, onFillComplete)
                }
              />
            ))}
          </ul>
        )}
      </ScrollArea>
    </section>
  );
}
