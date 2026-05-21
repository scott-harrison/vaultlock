import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { LoginItemPlaintext, NoteItemPlaintext, VaultItemType } from "@vaultlock/shared/types";
import { useId } from "react";

export interface VaultCreateDraft {
  createType: VaultItemType;
  loginDraft: LoginItemPlaintext;
  noteDraft: NoteItemPlaintext;
}

interface VaultCreateDialogProps {
  open: boolean;
  isSubmitting: boolean;
  draft: VaultCreateDraft;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCreateTypeChange: (type: VaultItemType) => void;
  onLoginFieldChange: (
    field: keyof LoginItemPlaintext,
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  onNoteFieldChange: (
    field: keyof NoteItemPlaintext,
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
}

const textareaClassName = cn(
  "flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
);

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium leading-none">
      {children}
    </label>
  );
}

export function VaultCreateDialog({
  open,
  isSubmitting,
  draft,
  onOpenChange,
  onSubmit,
  onCreateTypeChange,
  onLoginFieldChange,
  onNoteFieldChange,
}: VaultCreateDialogProps) {
  const formId = useId();

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add vault item</DialogTitle>
        </DialogHeader>

        <form id={formId} className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <FieldLabel htmlFor={`${formId}-type`}>Item type</FieldLabel>
            <select
              id={`${formId}-type`}
              className={cn(
                "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              )}
              value={draft.createType}
              disabled={isSubmitting}
              onChange={(event) => onCreateTypeChange(event.target.value as VaultItemType)}
            >
              <option value="login">Login</option>
              <option value="note">Secure note</option>
            </select>
          </div>

          {draft.createType === "login" ? (
            <>
              <div className="space-y-2">
                <FieldLabel htmlFor={`${formId}-title`}>Title</FieldLabel>
                <Input
                  id={`${formId}-title`}
                  placeholder="e.g. GitHub"
                  value={draft.loginDraft.title ?? ""}
                  disabled={isSubmitting}
                  onChange={(event) => onLoginFieldChange("title", event)}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor={`${formId}-url`}>URL</FieldLabel>
                <Input
                  id={`${formId}-url`}
                  placeholder="https://"
                  inputMode="url"
                  value={draft.loginDraft.url ?? ""}
                  disabled={isSubmitting}
                  onChange={(event) => onLoginFieldChange("url", event)}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor={`${formId}-username`}>Username</FieldLabel>
                <Input
                  id={`${formId}-username`}
                  autoComplete="username"
                  value={draft.loginDraft.username ?? ""}
                  disabled={isSubmitting}
                  onChange={(event) => onLoginFieldChange("username", event)}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor={`${formId}-password`}>Password</FieldLabel>
                <Input
                  id={`${formId}-password`}
                  type="password"
                  autoComplete="new-password"
                  value={draft.loginDraft.password ?? ""}
                  disabled={isSubmitting}
                  onChange={(event) => onLoginFieldChange("password", event)}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor={`${formId}-notes`}>Notes</FieldLabel>
                <textarea
                  id={`${formId}-notes`}
                  className={textareaClassName}
                  rows={3}
                  value={draft.loginDraft.notes ?? ""}
                  disabled={isSubmitting}
                  onChange={(event) => onLoginFieldChange("notes", event)}
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <FieldLabel htmlFor={`${formId}-note-title`}>Title</FieldLabel>
                <Input
                  id={`${formId}-note-title`}
                  placeholder="e.g. Wi-Fi password"
                  value={draft.noteDraft.title ?? ""}
                  disabled={isSubmitting}
                  onChange={(event) => onNoteFieldChange("title", event)}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor={`${formId}-content`}>Content</FieldLabel>
                <textarea
                  id={`${formId}-content`}
                  className={textareaClassName}
                  rows={5}
                  value={draft.noteDraft.content ?? ""}
                  disabled={isSubmitting}
                  onChange={(event) => onNoteFieldChange("content", event)}
                />
              </div>
            </>
          )}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
