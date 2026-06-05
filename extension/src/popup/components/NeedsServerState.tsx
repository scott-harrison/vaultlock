import { Button } from "@vaultlock/ui/components/ui/button";
import { authPrimaryButtonClassName } from "../constants";
import { PopupHeader } from "./PopupHeader";
import { PopupShell } from "./PopupShell";

export function NeedsServerState() {
  return (
    <PopupShell>
      <PopupHeader />
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Configure your VaultLock server URL before signing in.
        </p>
        <Button
          type="button"
          className={authPrimaryButtonClassName}
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          Open settings
        </Button>
      </div>
    </PopupShell>
  );
}
