import { useId, useState } from "react";

interface CheckEmailScreenProps {
  email: string;
  isSubmitting: boolean;
  error: string | null;
  success: string | null;
  onVerify: (token: string) => void;
  onGoToSignIn: () => void;
}

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
    <section className="screen">
      <div className="screen-header">
        <h1>Check your email</h1>
        <p className="hint">
          We sent a verification link to <strong>{email}</strong>. Click the link in your email,
          then return here and sign in.
        </p>
      </div>

      <form className="screen-form" onSubmit={handleSubmit}>
        <label className="field-label" htmlFor={`${formId}-token`}>
          Verification token
        </label>
        <input
          id={`${formId}-token`}
          className="text-input"
          type="text"
          autoComplete="one-time-code"
          placeholder="Paste token from email"
          value={token}
          disabled={isSubmitting}
          onChange={(event) => setToken(event.currentTarget.value)}
        />

        {error && <p className="feedback feedback-error">{error}</p>}
        {success && <p className="feedback feedback-success">{success}</p>}

        <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
          Verify email
        </button>
      </form>

      <p className="screen-footer">
        Already verified?{" "}
        <button type="button" className="link-btn" onClick={onGoToSignIn}>
          Sign in
        </button>
      </p>
    </section>
  );
}
