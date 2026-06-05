import type { LoginItemPlaintext, NoteItemPlaintext } from "@vaultlock/shared/types";
import { Button } from "@vaultlock/ui/components/ui/button";
import { cn } from "@vaultlock/ui/lib/utils";
import { type DecryptedVaultItem, getDisplaySubtitle, getDisplayTitle } from "../../lib/vaultItems";
import { VaultItemTypeIcon } from "./VaultItemTypeIcon";

interface VaultListItemProps {
  item: DecryptedVaultItem;
  showFill: boolean;
  isFilling: boolean;
  copiedField: string | null;
  onCopy: (text: string, fieldKey: string) => void;
  onFill: () => void;
}

export function VaultListItem({
  item,
  showFill,
  isFilling,
  copiedField,
  onCopy,
  onFill,
}: VaultListItemProps) {
  const title = getDisplayTitle(item);
  const subtitle = getDisplaySubtitle(item);
  const isLogin = item.itemType === "login";
  const login = isLogin ? (item.plaintext as LoginItemPlaintext) : null;
  const note = item.itemType === "note" ? (item.plaintext as NoteItemPlaintext) : null;

  return (
    <li className="rounded-lg border border-border/60 bg-card/50 p-2.5">
      <div className="flex items-start gap-2.5">
        <VaultItemTypeIcon itemType={item.itemType} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>

      {isLogin && login ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {login.username ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => onCopy(login.username ?? "", `${item.id}-user`)}
            >
              {copiedField === `${item.id}-user` ? "Copied" : "Copy user"}
            </Button>
          ) : null}
          {login.password ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => onCopy(login.password ?? "", `${item.id}-pass`)}
            >
              {copiedField === `${item.id}-pass` ? "Copied" : "Copy pass"}
            </Button>
          ) : null}
          {showFill && login.password ? (
            <Button
              type="button"
              size="sm"
              className={cn("h-7 px-2.5 text-xs", isFilling && "opacity-70")}
              disabled={isFilling}
              onClick={onFill}
            >
              {isFilling ? "Filling…" : "Fill"}
            </Button>
          ) : null}
        </div>
      ) : null}

      {note?.content ? (
        <p className="mt-2 line-clamp-3 text-xs text-muted-foreground whitespace-pre-wrap">
          {note.content.length > 120 ? `${note.content.slice(0, 120)}…` : note.content}
        </p>
      ) : null}
    </li>
  );
}
