import { AuthFeedback } from "@/components/auth/AuthFeedback";
import { AuthField } from "@/components/auth/AuthField";
import { AuthUserChip } from "@/components/auth/AuthUserChip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useId, useRef, useState } from "react";

interface UnlockScreenProps {
  email: string;
  isSubmitting: boolean;
  error: string | null;
  success: string | null;
  onUnlock: (password: string) => void;
  onSignOut: () => void;
}

const authInputClassName =
  "h-11 rounded-lg border-border/80 bg-muted/30 shadow-none focus-visible:ring-primary/40";
const authPrimaryButtonClassName =
  "h-11 w-full rounded-full bg-foreground text-background shadow-sm hover:bg-foreground/90";

export function UnlockScreen({
  email,
  isSubmitting,
  error,
  success,
  onUnlock,
  onSignOut,
}: UnlockScreenProps) {
  const formId = useId();
  const passwordRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onUnlock(password);
  };

  const openPasswordForm = () => {
    setShowPasswordForm(true);
    queueMicrotask(() => {
      passwordRef.current?.focus();
    });
  };

  return (
    <div className="space-y-8">
      <AuthUserChip email={email} onSwitchAccount={onSignOut} />

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Unlock your vault</h1>
        <p className="text-sm text-muted-foreground">
          Enter your master password to decrypt your items on this device.
        </p>
      </div>

      {!showPasswordForm ? (
        <div className="space-y-3">
          <Button type="button" className={authPrimaryButtonClassName} onClick={openPasswordForm}>
            Use Master Password
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <AuthField label="Master password" htmlFor={`${formId}-password`}>
            <Input
              id={`${formId}-password`}
              ref={passwordRef}
              className={authInputClassName}
              type="password"
              autoComplete="current-password"
              placeholder="Master password"
              value={password}
              disabled={isSubmitting}
              onChange={(event) => setPassword(event.target.value)}
            />
          </AuthField>

          {error && <AuthFeedback variant="error">{error}</AuthFeedback>}
          {success && <AuthFeedback variant="success">{success}</AuthFeedback>}

          <Button type="submit" className={authPrimaryButtonClassName} disabled={isSubmitting}>
            {isSubmitting ? "Unlocking…" : "Unlock vault"}
          </Button>

          <Button
            type="button"
            variant="outline"
            className={cn("h-11 w-full rounded-full border-border/80 bg-transparent")}
            disabled={isSubmitting}
            onClick={() => {
              setShowPasswordForm(false);
              setPassword("");
            }}
          >
            Back
          </Button>
        </form>
      )}

      {!showPasswordForm && (error || success) && (
        <div className="space-y-2">
          {error && <AuthFeedback variant="error">{error}</AuthFeedback>}
          {success && <AuthFeedback variant="success">{success}</AuthFeedback>}
        </div>
      )}
    </div>
  );
}
