import { AuthFeedback } from "@/components/auth/AuthFeedback";
import { AuthField } from "@/components/auth/AuthField";
import { Button } from "@vaultlock/ui/components/ui/button";
import { Input } from "@vaultlock/ui/components/ui/input";
import { useId, useState } from "react";

interface SignInScreenProps {
  initialEmail?: string;
  isSubmitting: boolean;
  error: string | null;
  onSignIn: (email: string, password: string) => void;
  onGoToRegister: () => void;
  onGoToVerify: () => void;
  hasPendingVerification: boolean;
}

const authInputClassName =
  "h-11 rounded-lg border-border/80 bg-muted/30 shadow-none focus-visible:ring-primary/40";
const authPrimaryButtonClassName =
  "h-11 w-full rounded-full bg-foreground text-background shadow-sm hover:bg-foreground/90";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function SignInScreen({
  initialEmail = "",
  isSubmitting,
  error,
  onSignIn,
  onGoToRegister,
  onGoToVerify,
  hasPendingVerification,
}: SignInScreenProps) {
  const formId = useId();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSignIn(normalizeEmail(email), password);
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and master password to access your vault.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <AuthField label="Email" htmlFor={`${formId}-email`}>
          <Input
            id={`${formId}-email`}
            className={authInputClassName}
            type="email"
            autoComplete="email"
            value={email}
            disabled={isSubmitting}
            onChange={(event) => setEmail(event.target.value)}
          />
        </AuthField>

        <AuthField label="Master password" htmlFor={`${formId}-password`}>
          <Input
            id={`${formId}-password`}
            className={authInputClassName}
            type="password"
            autoComplete="current-password"
            value={password}
            disabled={isSubmitting}
            onChange={(event) => setPassword(event.target.value)}
          />
        </AuthField>

        {error && <AuthFeedback variant="error">{error}</AuthFeedback>}

        <Button type="submit" className={authPrimaryButtonClassName} disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {hasPendingVerification && (
        <p className="text-center text-sm text-muted-foreground">
          Waiting for email verification?{" "}
          <button
            type="button"
            className="font-medium text-foreground underline-offset-4 hover:underline"
            onClick={onGoToVerify}
          >
            Enter verification code
          </button>
        </p>
      )}

      <p className="text-center text-sm text-muted-foreground">
        New to Vaultlock?{" "}
        <button
          type="button"
          className="font-medium text-foreground underline-offset-4 hover:underline"
          onClick={onGoToRegister}
        >
          Create an account
        </button>
      </p>
    </div>
  );
}
