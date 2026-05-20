import { useId, useMemo, useState } from "react";
import { evaluatePasswordStrength } from "../../lib/passwordStrength";
import { PasswordStrengthMeter } from "../PasswordStrengthMeter";

interface RegisterScreenProps {
  initialEmail?: string;
  isSubmitting: boolean;
  error: string | null;
  onRegister: (email: string, password: string) => void;
  onGoToSignIn: () => void;
}

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
    <section className="screen">
      <div className="screen-header">
        <h1>Create your account</h1>
        <p className="hint">Your master password encrypts your vault. Choose a strong one.</p>
      </div>

      <form className="screen-form" onSubmit={handleSubmit}>
        <label className="field-label" htmlFor={`${formId}-email`}>
          Email
        </label>
        <input
          id={`${formId}-email`}
          className="text-input"
          type="email"
          autoComplete="email"
          value={email}
          disabled={isSubmitting}
          onChange={(event) => setEmail(event.currentTarget.value)}
        />

        <label className="field-label" htmlFor={`${formId}-password`}>
          Master password
        </label>
        <input
          id={`${formId}-password`}
          className="text-input"
          type="password"
          autoComplete="new-password"
          value={password}
          disabled={isSubmitting}
          onChange={(event) => setPassword(event.currentTarget.value)}
        />
        {password && <PasswordStrengthMeter strength={strength} />}

        <label className="field-label" htmlFor={`${formId}-confirm`}>
          Confirm password
        </label>
        <input
          id={`${formId}-confirm`}
          className="text-input"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          disabled={isSubmitting}
          onChange={(event) => setConfirmPassword(event.currentTarget.value)}
        />

        {passwordsMismatch && <p className="feedback feedback-error">{passwordsMismatch}</p>}
        {error && (
          <p className="feedback feedback-error">
            {error}
            {error.includes("already exists") && (
              <>
                {" "}
                <button type="button" className="link-btn" onClick={onGoToSignIn}>
                  Sign in instead
                </button>
              </>
            )}
          </p>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={isSubmitting || !strength.isStrongEnough || Boolean(passwordsMismatch)}
        >
          Create account
        </button>
      </form>

      <p className="screen-footer">
        Already have an account?{" "}
        <button type="button" className="link-btn" onClick={onGoToSignIn}>
          Sign in
        </button>
      </p>
    </section>
  );
}
