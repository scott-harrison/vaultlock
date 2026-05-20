import { useId, useRef, useState } from "react";
import { useMountEffect } from "../../hooks/useMountEffect";

interface UnlockScreenProps {
  email: string;
  isSubmitting: boolean;
  error: string | null;
  success: string | null;
  onUnlock: (password: string) => void;
  onSignOut: () => void;
}

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

  useMountEffect(() => {
    passwordRef.current?.focus();
    return undefined;
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onUnlock(password);
  };

  return (
    <section className="screen unlock-screen">
      <div className="screen-header">
        <div className="account-badge" aria-hidden>
          {email.charAt(0).toUpperCase()}
        </div>
        <h1>Welcome back</h1>
        <p className="hint">
          Signed in as <strong>{email}</strong>. Enter your master password to unlock your vault.
        </p>
      </div>

      <form className="screen-form" onSubmit={handleSubmit}>
        <label className="field-label" htmlFor={`${formId}-password`}>
          Master password
        </label>
        <input
          id={`${formId}-password`}
          ref={passwordRef}
          className="text-input text-input-lg"
          type="password"
          autoComplete="current-password"
          placeholder="Master password"
          value={password}
          disabled={isSubmitting}
          onChange={(event) => setPassword(event.currentTarget.value)}
        />

        {error && <p className="feedback feedback-error">{error}</p>}
        {success && <p className="feedback feedback-success">{success}</p>}

        <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
          Unlock vault
        </button>
      </form>

      <p className="screen-footer">
        <button type="button" className="link-btn" onClick={onSignOut}>
          Sign out
        </button>
      </p>
    </section>
  );
}
