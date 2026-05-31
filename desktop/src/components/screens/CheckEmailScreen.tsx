import { AuthFeedback } from "@/components/auth/AuthFeedback";
import { AuthField } from "@/components/auth/AuthField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useId, useState } from "react";

interface CheckEmailScreenProps {
  email: string;
  isSubmitting: boolean;
  error: string | null;
  success: string | null;
  onVerify: (token: string) => void;
  onGoToSignIn: () => void;
}

const authInputClassName =
  "h-11 rounded-lg border-border/80 bg-muted/30 shadow-none focus-visible:ring-primary/40";
const authPrimaryButtonClassName =
  "h-11 w-full rounded-full bg-foreground text-background shadow-sm hover:bg-foreground/90";

export function CheckEmailScreen({
  email,
  isSubmitting,
  error,
  success,
  onVerify,
  onGoToSignIn,
}: CheckEmailScreenProps) {
  const formId = useId();
  const [token, setToken] = useState("");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onVerify(token.trim());
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          We sent a verification link to{" "}
          <span className="font-medium text-foreground">{email}</span>. Open the link in your email
          to verify, then sign in here. Only paste the token below if the link did not work.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <AuthField label="Verification token" htmlFor={`${formId}-token`}>
          <Input
            id={`${formId}-token`}
            className={authInputClassName}
            type="text"
            autoComplete="one-time-code"
            placeholder="Paste token from email"
            value={token}
            disabled={isSubmitting}
            onChange={(event) => setToken(event.target.value)}
          />
        </AuthField>

        {error && <AuthFeedback variant="error">{error}</AuthFeedback>}
        {success && <AuthFeedback variant="success">{success}</AuthFeedback>}

        <Button type="submit" className={authPrimaryButtonClassName} disabled={isSubmitting}>
          {isSubmitting ? "Verifying…" : "Verify email"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already verified?{" "}
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
