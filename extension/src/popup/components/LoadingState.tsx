import { Button } from "@vaultlock/ui/components/ui/button";
import { authPrimaryButtonClassName } from "../constants";
import { PopupShell } from "./PopupShell";

export function LoadingState() {
  return (
    <PopupShell className="flex items-center justify-center">
      <Button type="button" disabled className={authPrimaryButtonClassName}>
        Loading…
      </Button>
    </PopupShell>
  );
}
