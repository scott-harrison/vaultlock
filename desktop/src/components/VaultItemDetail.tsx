import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { DecryptedVaultItem } from "@/lib/vaultItems";
import { vaultItemDisplayTitle } from "@/lib/vaultItems";
import type { LoginItemPlaintext, NoteItemPlaintext } from "@vaultlock/shared/types";
import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";

interface VaultItemDetailProps {
  item: DecryptedVaultItem | null;
}

function DetailField({
  label,
  value,
  copyValue,
  onCopied,
  mono = false,
}: {
  label: string;
  value: string;
  copyValue?: string;
  onCopied: () => void;
  mono?: boolean;
}) {
  const fieldId = useId();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={fieldId} className="text-sm font-medium text-muted-foreground">
          {label}
        </label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => void navigator.clipboard.writeText(copyValue ?? value).then(onCopied)}
        >
          Copy
        </Button>
      </div>
      <p
        id={fieldId}
        className={cn(
          "rounded-md border border-border bg-muted/40 px-3 py-2 text-sm break-words whitespace-pre-wrap",
          mono && "font-mono",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function LoginDetail({
  item,
  onCopied,
}: {
  item: DecryptedVaultItem;
  onCopied: () => void;
}) {
  const passwordId = useId();
  const login = item.plaintext as LoginItemPlaintext;
  const [showPassword, setShowPassword] = useState(false);
  const password = login.password ?? "";

  return (
    <div className="space-y-4">
      {login.title?.trim() && (
        <DetailField label="Title" value={login.title.trim()} onCopied={onCopied} />
      )}
      {login.url?.trim() && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-muted-foreground">URL</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                const url = login.url?.trim();
                if (url) {
                  void navigator.clipboard.writeText(url).then(onCopied);
                }
              }}
            >
              Copy
            </Button>
          </div>
          <a
            className="block text-sm text-primary break-all hover:underline"
            href={login.url.trim()}
            target="_blank"
            rel="noreferrer noopener"
          >
            {login.url.trim()}
          </a>
        </div>
      )}
      {login.username?.trim() && (
        <DetailField label="Username" value={login.username.trim()} onCopied={onCopied} />
      )}
      {password && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={passwordId} className="text-sm font-medium text-muted-foreground">
              Password
            </label>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? (
                  <>
                    <EyeOff className="size-3.5" /> Hide
                  </>
                ) : (
                  <>
                    <Eye className="size-3.5" /> Show
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => void navigator.clipboard.writeText(password).then(onCopied)}
              >
                Copy
              </Button>
            </div>
          </div>
          <p
            id={passwordId}
            className="rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-sm"
          >
            {showPassword ? password : "••••••••"}
          </p>
        </div>
      )}
      {login.notes?.trim() && (
        <DetailField label="Notes" value={login.notes.trim()} onCopied={onCopied} />
      )}
    </div>
  );
}

function NoteDetail({
  item,
  onCopied,
}: {
  item: DecryptedVaultItem;
  onCopied: () => void;
}) {
  const note = item.plaintext as NoteItemPlaintext;

  return (
    <div className="space-y-4">
      {note.title?.trim() && (
        <DetailField label="Title" value={note.title.trim()} onCopied={onCopied} />
      )}
      {note.content?.trim() && (
        <DetailField label="Content" value={note.content.trim()} onCopied={onCopied} />
      )}
    </div>
  );
}

export function VaultItemDetail({ item }: VaultItemDetailProps) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const handleCopied = () => {
    setCopyMessage("Copied to clipboard.");
    window.setTimeout(() => setCopyMessage(null), 2000);
  };

  if (!item) {
    return (
      <section className="flex h-full flex-1 items-center justify-center bg-background p-8">
        <div className="max-w-sm text-center">
          <h2 className="text-lg font-semibold">Select an item</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a login or note from the list to view its details here.
          </p>
        </div>
      </section>
    );
  }

  const hasFields =
    item.itemType === "login"
      ? Object.values(item.plaintext as LoginItemPlaintext).some(
          (value) => typeof value === "string" && value.trim().length > 0,
        )
      : Object.values(item.plaintext as NoteItemPlaintext).some(
          (value) => typeof value === "string" && value.trim().length > 0,
        );

  return (
    <section
      className="flex h-full min-w-0 flex-1 flex-col bg-background"
      aria-labelledby={`vault-detail-${item.id}`}
    >
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <Badge variant="secondary" className="capitalize">
              {item.itemType}
            </Badge>
            <h2
              id={`vault-detail-${item.id}`}
              className="truncate text-2xl font-semibold tracking-tight"
            >
              {vaultItemDisplayTitle(item)}
            </h2>
          </div>
        </div>
        {copyMessage && <p className="mt-3 text-sm text-primary">{copyMessage}</p>}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {item.itemType === "login" ? (
          <LoginDetail item={item} onCopied={handleCopied} />
        ) : item.itemType === "note" ? (
          <NoteDetail item={item} onCopied={handleCopied} />
        ) : (
          <p className="text-sm text-muted-foreground">This item type is not supported yet.</p>
        )}
        {!hasFields && (
          <p className="text-sm text-muted-foreground">This item has no saved fields.</p>
        )}

        <Separator className="my-6" />
        <p className="text-xs text-muted-foreground">
          Last updated {new Date(item.updatedAt).toLocaleString()}
        </p>
      </div>
    </section>
  );
}
