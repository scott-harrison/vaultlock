import { Button } from "@vaultlock/ui/components/ui/button";
import { PopupShell } from "./PopupShell";

export function LoadingState() {
  return (
    <PopupShell className="flex items-center justify-center">
      <Button type="button" disabled variant="secondary" className="w-full">
        Loading…
      </Button>
    </PopupShell>
  );
}
