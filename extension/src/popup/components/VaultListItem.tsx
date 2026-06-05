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
    <li className="rounded-lg transition-colors hover:bg-accent hover:text-accent-foreground">
      <div className="flex w-full items-center gap-3 px-3 py-2.5">
        <VaultItemTypeIcon itemType={item.itemType} />
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium">{title}</p>
          {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>

      {isLogin && login ? (
        <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2.5">
          {login.username ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 px-2 text-xs"
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
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => onCopy(login.password ?? "", `${item.id}-pass`)}
            >
              {copiedField === `${item.id}-pass` ? "Copied" : "Copy pass"}
            </Button>
          ) : null}
          {showFill && login.password ? (
            <Button
              type="button"
              size="sm"
              className={cn(
                "h-7 rounded-full bg-foreground px-2.5 text-xs text-background hover:bg-foreground/90",
                isFilling && "opacity-70",
              )}
              disabled={isFilling}
              onClick={onFill}
            >
              {isFilling ? "Filling…" : "Fill"}
            </Button>
          ) : null}
        </div>
      ) : null}

      {note?.content ? (
        <p className="px-3 pb-2.5 text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
          {note.content.length > 120 ? `${note.content.slice(0, 120)}…` : note.content}
        </p>
      ) : null}
    </li>
  );
}
