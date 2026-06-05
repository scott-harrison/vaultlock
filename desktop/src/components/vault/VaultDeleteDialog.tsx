import { Button } from "@vaultlock/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@vaultlock/ui/components/ui/dialog";
import { vaultItemDisplayTitle } from "@/lib/vaultItems";
import type { DecryptedVaultItem } from "@/lib/vaultItems";

interface VaultDeleteDialogProps {
  item: DecryptedVaultItem | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function VaultDeleteDialog({
  item,
  isSubmitting,
  onOpenChange,
  onConfirm,
}: VaultDeleteDialogProps) {
  return (
    <Dialog open={item !== null} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this item?</DialogTitle>
          <DialogDescription>
            {item
              ? `"${vaultItemDisplayTitle(item)}" will be permanently removed from your vault. This cannot be undone.`
              : "This item will be permanently removed from your vault."}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={isSubmitting} onClick={onConfirm}>
            {isSubmitting ? "Deleting…" : "Delete item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
