import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import { AuthFeedback } from "@/components/auth/AuthFeedback";
import { AuthField } from "@/components/auth/AuthField";
import { Button } from "@vaultlock/ui/components/ui/button";
import { Input } from "@vaultlock/ui/components/ui/input";
import { evaluatePasswordStrength } from "@/lib/passwordStrength";
import { useId, useMemo, useState } from "react";

interface RegisterScreenProps {
  initialEmail?: string;
  isSubmitting: boolean;
  error: string | null;
  onRegister: (email: string, password: string) => void;
  onGoToSignIn: () => void;
}

const authInputClassName =
  "h-11 rounded-lg border-border/80 bg-muted/30 shadow-none focus-visible:ring-primary/40";
const authPrimaryButtonClassName =
  "h-11 w-full rounded-full bg-foreground text-background shadow-sm hover:bg-foreground/90";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function RegisterScreen({
  initialEmail = "",
  isSubmitting,
  error,
  onRegister,
  onGoToSignIn,
}: RegisterScreenProps) {
  const formId = useId();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const strength = useMemo(
    () => evaluatePasswordStrength(password, normalizeEmail(email)),
    [password, email],
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      return;
    }
    if (!strength.isStrongEnough) {
      return;
    }
    onRegister(normalizeEmail(email), password);
  };

  const passwordsMismatch =
    confirmPassword.length > 0 && password !== confirmPassword ? "Passwords do not match." : null;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Your master password encrypts your vault. Choose a strong one — we cannot recover it.
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
            autoComplete="new-password"
            value={password}
            disabled={isSubmitting}
            onChange={(event) => setPassword(event.target.value)}
          />
        </AuthField>
        {password && <PasswordStrengthMeter strength={strength} />}

        <AuthField label="Confirm password" htmlFor={`${formId}-confirm`}>
          <Input
            id={`${formId}-confirm`}
            className={authInputClassName}
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            disabled={isSubmitting}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </AuthField>

        {passwordsMismatch && <AuthFeedback variant="error">{passwordsMismatch}</AuthFeedback>}
        {error && (
          <AuthFeedback variant="error">
            {error}
            {error.includes("already exists") && (
              <>
                {" "}
                <button
                  type="button"
                  className="font-medium underline-offset-4 hover:underline"
                  onClick={onGoToSignIn}
                >
                  Sign in instead
                </button>
              </>
            )}
          </AuthFeedback>
        )}

        <Button
          type="submit"
          className={authPrimaryButtonClassName}
          disabled={isSubmitting || !strength.isStrongEnough || Boolean(passwordsMismatch)}
        >
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <button
          type="button"
          className="font-medium text-foreground underline-offset-4 hover:underline"
          onClick={onGoToSignIn}
        >
          Sign in
        </button>
      </p>
    </div>
  );
}
