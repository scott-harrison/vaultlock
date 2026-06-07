import { Button } from "@vaultlock/ui/components/ui/button";
import { Input } from "@vaultlock/ui/components/ui/input";
import { useId } from "react";
import { authInputClassName, authPrimaryButtonClassName } from "../constants";
import { AuthFeedback } from "./AuthFeedback";
import { AuthField } from "./AuthField";
import { AuthUserChip } from "./AuthUserChip";
import { PopupHeader } from "./PopupHeader";
import { PopupShell } from "./PopupShell";

interface UnlockFormProps {
  serverUrl: string;
  email: string;
  masterPassword: string;
  isSubmitting: boolean;
  error: string;
  savePromptHostname?: string;
  onMasterPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onSignOut: () => void;
}

export function UnlockForm({
  serverUrl,
  email,
  masterPassword,
  isSubmitting,
  error,
  onMasterPasswordChange,
  onSubmit,
  onSignOut,
  savePromptHostname,
}: UnlockFormProps) {
  const formId = useId();

  return (
    <PopupShell>
      <PopupHeader serverUrl={serverUrl} />
      <div className="space-y-6">
        <AuthUserChip email={email} />

        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Unlock your vault</h2>
          <p className="text-sm text-muted-foreground">
            {savePromptHostname
              ? `Unlock to review and save the login for ${savePromptHostname}.`
              : "Enter your master password to decrypt your items on this device."}
          </p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <AuthField label="Master password" htmlFor={`${formId}-password`}>
            <Input
              id={`${formId}-password`}
              className={authInputClassName}
              type="password"
              autoComplete="current-password"
              placeholder="Master password"
              value={masterPassword}
              disabled={isSubmitting}
              required
              onChange={(event) => onMasterPasswordChange(event.target.value)}
            />
          </AuthField>

          {error ? <AuthFeedback variant="error">{error}</AuthFeedback> : null}

          <Button type="submit" className={authPrimaryButtonClassName} disabled={isSubmitting}>
            {isSubmitting ? "Unlocking…" : "Unlock vault"}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-full border-border/80 bg-transparent"
            disabled={isSubmitting}
            onClick={onSignOut}
          >
            Sign out
          </Button>
        </form>
      </div>
    </PopupShell>
  );
}
