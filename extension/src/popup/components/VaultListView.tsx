import type { LoginItemPlaintext } from "@vaultlock/shared/types";
import { Button } from "@vaultlock/ui/components/ui/button";
import { Input } from "@vaultlock/ui/components/ui/input";
import { ScrollArea } from "@vaultlock/ui/components/ui/scroll-area";
import { cn } from "@vaultlock/ui/lib/utils";
import { Globe, KeyRound, LogOut, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import type { AutofillRequest } from "../../lib/messaging";
import { useVaultList } from "../hooks/useVaultList";
import { formatRelativeTime } from "../utils/formatRelativeTime";
import { AuthFeedback } from "./AuthFeedback";
import { FillRequestBanner } from "./FillRequestBanner";
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
    fillContext,
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
  const showFillBanner = fillContext.isActive && fillContext.hostname;

  const emptyState = (() => {
    if (error) {
      return null;
    }

    if (fillContext.isActive && fillContext.hostnameMatchCount === 0) {
      return (
        <VaultEmptyState
          className="py-12"
          icon={Globe}
          title={`No logins for ${fillContext.hostname}`}
          description={
            fillContext.totalLoginCount > 0
              ? "None of your saved logins match this hostname. Add one for this site or clear the search filter."
              : "Add a login to your vault, then click the field lock icon again."
          }
        />
      );
    }

    if (fillContext.isActive && isSearchActive && items.length === 0) {
      return (
        <VaultEmptyState
          className="py-12"
          icon={Search}
          title="No matching logins"
          description={`Try a different search term for ${fillContext.hostname}.`}
        />
      );
    }

    if (isSearchActive) {
      return (
        <VaultEmptyState
          className="py-12"
          icon={Search}
          title="No matches"
          description="Try a different search term or clear the filter."
        />
      );
    }

    return (
      <VaultEmptyState
        className="py-12"
        icon={KeyRound}
        title="No items yet"
        description="Items you add will appear here."
      />
    );
  })();

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card/40">
      {showFillBanner ? (
        <div className="border-b border-border p-3">
          <FillRequestBanner
            hostname={fillContext.hostname ?? ""}
            matchCount={fillContext.hostnameMatchCount}
            totalLoginCount={fillContext.totalLoginCount}
          />
        </div>
      ) : null}

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
            placeholder={fillContext.isActive ? "Search matching logins…" : "Search…"}
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
        ) : items.length === 0 ? (
          emptyState
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
