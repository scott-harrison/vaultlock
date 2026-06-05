import { Button } from "@vaultlock/ui/components/ui/button";
import { Input } from "@vaultlock/ui/components/ui/input";
import { useId } from "react";
import { authInputClassName, authPrimaryButtonClassName } from "../constants";
import { AuthFeedback } from "./AuthFeedback";
import { AuthField } from "./AuthField";
import { PopupHeader } from "./PopupHeader";
import { PopupShell } from "./PopupShell";

interface LoginFormProps {
  serverUrl: string;
  email: string;
  masterPassword: string;
  isSubmitting: boolean;
  error: string;
  onEmailChange: (value: string) => void;
  onMasterPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}

export function LoginForm({
  serverUrl,
  email,
  masterPassword,
  isSubmitting,
  error,
  onEmailChange,
  onMasterPasswordChange,
  onSubmit,
}: LoginFormProps) {
  const formId = useId();

  return (
    <PopupShell>
      <PopupHeader serverUrl={serverUrl} />
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Sign in</h2>
          <p className="text-xs text-muted-foreground">
            Enter your email and master password to unlock your vault.
          </p>
        </div>

        <form className="space-y-3" onSubmit={onSubmit}>
          <AuthField label="Email" htmlFor={`${formId}-email`}>
            <Input
              id={`${formId}-email`}
              className={authInputClassName}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              disabled={isSubmitting}
              required
              onChange={(event) => onEmailChange(event.target.value)}
            />
          </AuthField>

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
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </PopupShell>
  );
}
