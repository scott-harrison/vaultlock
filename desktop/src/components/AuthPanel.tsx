import { VaultlockApiError } from "@vaultlock/shared/api";
import { hashMasterPasswordAuth, verifyMasterPasswordAuth } from "@vaultlock/shared/crypto";
import { useState } from "react";
import { useMountEffect } from "../hooks/useMountEffect";
import { createApiClient } from "../lib/apiClient";
import {
  type AuthSession,
  clearSession,
  loadCredentials,
  loadSession,
  saveCredentials,
  saveSession,
} from "../lib/authSession";

type AuthTab = "register" | "verify" | "login";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function AuthPanel() {
  const [tab, setTab] = useState<AuthTab>("login");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const [email, setEmail] = useState("");
  const [masterPassword, setMasterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verifyToken, setVerifyToken] = useState("");

  useMountEffect(() => {
    let cancelled = false;

    loadSession()
      .then((loaded) => {
        if (!cancelled) {
          setSession(loaded);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  });

  const resetFeedback = () => {
    setMessage(null);
    setIsError(false);
  };

  const showSuccess = (text: string) => {
    setMessage(text);
    setIsError(false);
  };

  const showError = (text: string) => {
    setMessage(text);
    setIsError(true);
  };

  const handleRegister = async () => {
    resetFeedback();
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !masterPassword) {
      showError("Email and master password are required.");
      return;
    }

    if (masterPassword !== confirmPassword) {
      showError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const masterPasswordHash = await hashMasterPasswordAuth(masterPassword);
      const client = await createApiClient();
      const response = await client.register({
        email: normalizedEmail,
        master_password_hash: masterPasswordHash,
      });

      await saveCredentials({ email: normalizedEmail, masterPasswordHash });
      showSuccess(response.message);
      setTab("verify");
      setVerifyToken("");
    } catch (error) {
      if (error instanceof VaultlockApiError) {
        showError(error.message);
      } else {
        showError(error instanceof Error ? error.message : "Registration failed");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async () => {
    resetFeedback();

    if (!verifyToken.trim()) {
      showError("Verification token is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const client = await createApiClient();
      const response = await client.verifyEmail({ token: verifyToken.trim() });
      const nextSession: AuthSession = {
        email: normalizeEmail(email) || "verified@vaultlock.local",
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
      };
      const credentials = await loadCredentials();
      if (credentials) {
        nextSession.email = credentials.email;
      }

      await saveSession(nextSession);
      setSession(nextSession);
      showSuccess(response.message);
    } catch (error) {
      if (error instanceof VaultlockApiError) {
        showError(error.message);
      } else {
        showError(error instanceof Error ? error.message : "Verification failed");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async () => {
    resetFeedback();
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !masterPassword) {
      showError("Email and master password are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const credentials = await loadCredentials();
      if (!credentials || credentials.email !== normalizedEmail) {
        showError("No local credentials for this email. Register on this device first.");
        return;
      }

      const passwordValid = await verifyMasterPasswordAuth(
        masterPassword,
        credentials.masterPasswordHash,
      );
      if (!passwordValid) {
        showError("Invalid credentials.");
        return;
      }

      const client = await createApiClient();
      const response = await client.login({
        email: normalizedEmail,
        master_password_hash: credentials.masterPasswordHash,
      });

      const nextSession: AuthSession = {
        email: normalizedEmail,
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
      };
      await saveSession(nextSession);
      setSession(nextSession);
      showSuccess(response.message);
    } catch (error) {
      if (error instanceof VaultlockApiError) {
        showError(error.message);
      } else {
        showError(error instanceof Error ? error.message : "Login failed");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    resetFeedback();
    await clearSession();
    setSession(null);
    setMasterPassword("");
    showSuccess("Signed out.");
  };

  if (isLoading) {
    return (
      <section className="card">
        <h2>Account</h2>
        <p className="hint">Loading session…</p>
      </section>
    );
  }

  if (session) {
    return (
      <section className="card">
        <h2>Signed in</h2>
        <p className="hint">
          Authenticated as <code>{session.email}</code>. Vault unlock comes in sub-task 11-05.
        </p>
        <div className="button-row">
          <button type="button" className="btn btn-secondary" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
        {message && (
          <p className={`feedback ${isError ? "feedback-error" : "feedback-info"}`}>{message}</p>
        )}
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Account</h2>
      <p className="hint">Register, verify your email, then sign in to your vault server.</p>

      <div className="tab-row" role="tablist" aria-label="Auth mode">
        {(["register", "verify", "login"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={`tab ${tab === value ? "tab-active" : ""}`}
            onClick={() => {
              setTab(value);
              resetFeedback();
            }}
          >
            {value === "register" ? "Register" : value === "verify" ? "Verify email" : "Sign in"}
          </button>
        ))}
      </div>

      {(tab === "register" || tab === "login") && (
        <>
          <label className="field-label" htmlFor="auth-email">
            Email
          </label>
          <input
            id="auth-email"
            className="text-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />

          <label className="field-label" htmlFor="auth-password">
            Master password
          </label>
          <input
            id="auth-password"
            className="text-input"
            type="password"
            autoComplete={tab === "register" ? "new-password" : "current-password"}
            value={masterPassword}
            onChange={(event) => setMasterPassword(event.currentTarget.value)}
          />
        </>
      )}

      {tab === "register" && (
        <>
          <label className="field-label" htmlFor="auth-confirm">
            Confirm password
          </label>
          <input
            id="auth-confirm"
            className="text-input"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.currentTarget.value)}
          />
          <div className="button-row">
            <button
              type="button"
              className="btn btn-primary"
              disabled={isSubmitting}
              onClick={handleRegister}
            >
              Create account
            </button>
          </div>
        </>
      )}

      {tab === "verify" && (
        <>
          <label className="field-label" htmlFor="verify-token">
            Verification token
          </label>
          <input
            id="verify-token"
            className="text-input"
            type="text"
            placeholder="Paste token from email or database (dev)"
            value={verifyToken}
            onChange={(event) => setVerifyToken(event.currentTarget.value)}
          />
          <p className="hint">
            In local dev without email, read <code>verification_token</code> from the{" "}
            <code>users</code> table.
          </p>
          <div className="button-row">
            <button
              type="button"
              className="btn btn-primary"
              disabled={isSubmitting}
              onClick={handleVerify}
            >
              Verify email
            </button>
          </div>
        </>
      )}

      {tab === "login" && (
        <div className="button-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={isSubmitting}
            onClick={handleLogin}
          >
            Sign in
          </button>
        </div>
      )}

      {message && (
        <p className={`feedback ${isError ? "feedback-error" : "feedback-info"}`}>{message}</p>
      )}
    </section>
  );
}
