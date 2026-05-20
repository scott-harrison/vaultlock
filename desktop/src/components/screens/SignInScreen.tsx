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
    <section className="screen">
      <div className="screen-header">
        <h1>Sign in</h1>
        <p className="hint">Enter your email and master password to sign in.</p>
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
          autoComplete="current-password"
          value={password}
          disabled={isSubmitting}
          onChange={(event) => setPassword(event.currentTarget.value)}
        />

        {error && <p className="feedback feedback-error">{error}</p>}

        <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
          Sign in
        </button>
      </form>

      {hasPendingVerification && (
        <p className="screen-note">
          Waiting for email verification?{" "}
          <button type="button" className="link-btn" onClick={onGoToVerify}>
            Enter verification code
          </button>
        </p>
      )}

      <p className="screen-footer">
        New to Vaultlock?{" "}
        <button type="button" className="link-btn" onClick={onGoToRegister}>
          Create an account
        </button>
      </p>
    </section>
  );
}
