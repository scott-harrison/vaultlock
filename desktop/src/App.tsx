import { VaultlockApiError } from "@vaultlock/shared/api";
import { hashMasterPasswordAuth } from "@vaultlock/shared/crypto";
import { useCallback, useState } from "react";
import { LoadingOverlay } from "./components/LoadingOverlay";
import { type ConnectionStatus, ServerStatusIndicator } from "./components/ServerStatusIndicator";
import { TitleBar } from "./components/TitleBar";
import { AuthLayout } from "./components/layout/AuthLayout";
import { CheckEmailScreen } from "./components/screens/CheckEmailScreen";
import { ConnectServerScreen } from "./components/screens/ConnectServerScreen";
import { RegisterScreen } from "./components/screens/RegisterScreen";
import { SignInScreen } from "./components/screens/SignInScreen";
import { UnlockScreen } from "./components/screens/UnlockScreen";
import { VaultScreen } from "./components/screens/VaultScreen";
import { TooltipProvider } from "./components/ui/tooltip";
import { useAutoLock } from "./hooks/useAutoLock";
import { useMountEffect } from "./hooks/useMountEffect";
import { useVerifyDeepLink } from "./hooks/useVerifyDeepLink";
import { createApiClient } from "./lib/apiClient";
import {
  type AuthSession,
  clearAllAuthData,
  clearPendingVerificationEmail,
  loadCredentials,
  loadPendingVerificationEmail,
  loadSession,
  saveCredentials,
  savePendingVerificationEmail,
  saveSession,
  sessionFromAuthResponse,
} from "./lib/authSession";
import {
  DEFAULT_SERVER_ADVANCED,
  type ServerAdvancedOptions,
  connectServer,
  loadServerAdvancedOptions,
  loadServerBaseUrl,
  saveServerAdvancedOptions,
  testServerConnection,
} from "./lib/serverSettings";
import { VAULT_LOCAL_KEYS_ERROR, VAULT_UNLOCK_ERROR, unlockVaultForUser } from "./lib/unlockVault";
import { clearWrappedDekStorage, lockVault } from "./lib/vaultSession";
import { clearAllVaultSyncTokens } from "./lib/vaultSync";
import "./App.css";

type WizardScreen = "connect" | "sign-in" | "register" | "check-email" | "unlock" | "vault";

const GENERIC_SIGN_IN_ERROR = "Couldn't sign in. Check your email and password.";
const GENERIC_UNLOCK_ERROR = "Couldn't unlock your vault. Try again.";
const GENERIC_REGISTER_ERROR = "Couldn't create account. Try again or sign in.";
const GENERIC_VERIFY_ERROR = "Couldn't verify your email. Check the token and try again.";
const ENCRYPTION_MESSAGE = "Deriving encryption keys…";
const AUTO_LOCK_MESSAGE = "Vault locked due to inactivity.";

async function persistCredentialsFromAuth(
  email: string,
  response: { master_password_hash?: string },
): Promise<void> {
  if (!response.master_password_hash?.trim()) {
    throw new Error("Server did not return a master password hash.");
  }
  await saveCredentials({ email, masterPasswordHash: response.master_password_hash });
}

function authErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof VaultlockApiError) {
    if (error.status === 401) {
      return error.message || GENERIC_SIGN_IN_ERROR;
    }
    if (error.status >= 500 && error.message.toLowerCase().includes("database")) {
      return "The server couldn't reach its database. Make sure PostgreSQL is running, then try again.";
    }
    return error.message || fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function resolveInitialScreen(
  serverUrl: string | null,
  session: AuthSession | null,
  pendingEmail: string | null,
): WizardScreen {
  if (!serverUrl) {
    return "connect";
  }
  if (session) {
    return "unlock";
  }
  if (pendingEmail) {
    return "check-email";
  }
  return "sign-in";
}

function App() {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [screen, setScreen] = useState<WizardScreen>("connect");
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [serverAdvanced, setServerAdvanced] =
    useState<ServerAdvancedOptions>(DEFAULT_SERVER_ADVANCED);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("unknown");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isVaultCreateOpen, setIsVaultCreateOpen] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [screenSuccess, setScreenSuccess] = useState<string | null>(null);
  const [registerEmailDraft, setRegisterEmailDraft] = useState("");
  const [signInEmailDraft, setSignInEmailDraft] = useState("");

  const refreshConnectionStatus = async (url: string, advanced: ServerAdvancedOptions) => {
    setConnectionStatus("checking");
    try {
      const ok = await testServerConnection(url, advanced);
      setConnectionStatus(ok ? "connected" : "failed");
    } catch {
      setConnectionStatus("failed");
    }
  };

  useMountEffect(() => {
    let cancelled = false;

    Promise.all([
      loadServerBaseUrl(),
      loadServerAdvancedOptions(),
      loadSession(),
      loadPendingVerificationEmail(),
    ])
      .then(async ([url, advanced, loadedSession, pendingEmail]) => {
        if (cancelled) {
          return;
        }

        setServerUrl(url);
        setServerAdvanced(advanced);
        setSession(loadedSession);
        setPendingVerificationEmail(pendingEmail);
        setScreen(resolveInitialScreen(url, loadedSession, pendingEmail));

        if (url) {
          await refreshConnectionStatus(url, advanced);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      });

    return () => {
      cancelled = true;
    };
  });

  const resetFeedback = () => {
    setScreenError(null);
    setScreenSuccess(null);
  };

  const handleConnect = async (url: string, advanced: ServerAdvancedOptions) => {
    resetFeedback();
    setIsSubmitting(true);
    try {
      const normalized = await connectServer(url, advanced);
      await saveServerAdvancedOptions(advanced);
      setServerUrl(normalized);
      setServerAdvanced(advanced);
      setConnectionStatus("connected");
      setScreen(session ? "unlock" : pendingVerificationEmail ? "check-email" : "sign-in");
    } catch (error) {
      setConnectionStatus("failed");
      setScreenError(error instanceof Error ? error.message : "Connection failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (email: string, password: string) => {
    resetFeedback();
    setRegisterEmailDraft(email);
    setIsSubmitting(true);
    setLoadingMessage(ENCRYPTION_MESSAGE);
    try {
      const masterPasswordHash = await hashMasterPasswordAuth(password);
      const client = await createApiClient();
      await client.register({ email, master_password_hash: masterPasswordHash });
      await saveCredentials({ email, masterPasswordHash });
      await savePendingVerificationEmail(email);
      setPendingVerificationEmail(email);
      setScreen("check-email");
    } catch (error) {
      if (error instanceof VaultlockApiError && error.status === 409) {
        setScreenError("An account with this email already exists.");
      } else {
        setScreenError(GENERIC_REGISTER_ERROR);
      }
    } finally {
      setIsSubmitting(false);
      setLoadingMessage(null);
    }
  };

  const completeVerification = async (token: string) => {
    const client = await createApiClient();
    const response = await client.verifyEmail({ token });
    const credentials = await loadCredentials();
    const email = credentials?.email ?? pendingVerificationEmail ?? "";
    const nextSession = sessionFromAuthResponse(email, response);
    await saveSession(nextSession);
    await persistCredentialsFromAuth(email, response);
    await clearPendingVerificationEmail();
    setPendingVerificationEmail(null);
    setSession(nextSession);
    setIsUnlocked(false);
    setScreen("unlock");
    setScreenSuccess("Email verified. Unlock your vault to continue.");
  };

  const handleVerify = async (token: string) => {
    resetFeedback();
    if (!token) {
      setScreenError(GENERIC_VERIFY_ERROR);
      return;
    }

    setIsSubmitting(true);
    try {
      await completeVerification(token);
    } catch {
      setScreenError(GENERIC_VERIFY_ERROR);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeepLink = (action: { type: "verify"; token: string } | { type: "sign-in" }) => {
    if (action.type === "sign-in") {
      resetFeedback();
      void clearPendingVerificationEmail().then(() => {
        setPendingVerificationEmail(null);
        setScreen("sign-in");
        setScreenSuccess("Email verified. Sign in to continue.");
      });
      return;
    }

    resetFeedback();
    setIsSubmitting(true);
    completeVerification(action.token)
      .catch(() => setScreenError(GENERIC_VERIFY_ERROR))
      .finally(() => setIsSubmitting(false));
  };

  useVerifyDeepLink(handleDeepLink);

  const handleSessionExpired = useCallback(() => {
    lockVault();
    setIsVaultCreateOpen(false);
    setIsUnlocked(false);
    setScreenError("Your session expired. Unlock the vault to continue.");
    setScreen("unlock");
  }, []);

  const lockVaultSession = useCallback((message?: string) => {
    lockVault();
    setScreenError(null);
    setScreenSuccess(message ?? null);
    setIsVaultCreateOpen(false);
    setIsUnlocked(false);
    setScreen("unlock");
  }, []);

  useAutoLock({
    enabled: isUnlocked && screen === "vault" && !isVaultCreateOpen,
    onLock: () => lockVaultSession(AUTO_LOCK_MESSAGE),
  });

  const handleSignIn = async (email: string, password: string) => {
    resetFeedback();
    setSignInEmailDraft(email);

    setIsSubmitting(true);
    setLoadingMessage(ENCRYPTION_MESSAGE);
    let authenticated = false;

    try {
      const client = await createApiClient();
      const response = await client.login({
        email,
        master_password: password,
      });
      authenticated = true;

      const nextSession = sessionFromAuthResponse(email, response);
      await saveSession(nextSession);
      await persistCredentialsFromAuth(email, response);
      await clearPendingVerificationEmail();
      setPendingVerificationEmail(null);
      setSession(nextSession);
      await unlockVaultForUser(email, password, response.master_password_hash);
      setIsVaultCreateOpen(false);
      setIsUnlocked(true);
      setScreen("vault");
    } catch (error) {
      lockVault();
      setIsUnlocked(false);
      if (error instanceof VaultlockApiError && error.status === 403) {
        setScreen("check-email");
        setScreenError("Verify your email before signing in.");
        return;
      }

      if (authenticated) {
        setScreen("unlock");
        if (error instanceof Error && error.message === VAULT_UNLOCK_ERROR) {
          setScreenError(VAULT_UNLOCK_ERROR);
        } else if (error instanceof Error && error.message === VAULT_LOCAL_KEYS_ERROR) {
          setScreenError(VAULT_LOCAL_KEYS_ERROR);
        } else {
          setScreenError(authErrorMessage(error, GENERIC_UNLOCK_ERROR));
        }
        return;
      }

      setScreenError(authErrorMessage(error, GENERIC_SIGN_IN_ERROR));
    } finally {
      setIsSubmitting(false);
      setLoadingMessage(null);
    }
  };

  const handleUnlock = async (password: string) => {
    resetFeedback();
    if (!session) {
      return;
    }

    setIsSubmitting(true);
    setLoadingMessage(ENCRYPTION_MESSAGE);
    try {
      const credentials = await loadCredentials();
      if (!credentials || credentials.email !== session.email) {
        setScreenError(GENERIC_SIGN_IN_ERROR);
        setScreen("sign-in");
        return;
      }

      const client = await createApiClient();
      const response = await client.login({
        email: session.email,
        master_password: password,
      });

      const nextSession = sessionFromAuthResponse(session.email, response);
      await saveSession(nextSession);
      await persistCredentialsFromAuth(session.email, response);
      setSession(nextSession);
      await unlockVaultForUser(session.email, password, response.master_password_hash);
      setIsVaultCreateOpen(false);
      setIsUnlocked(true);
      setScreen("vault");
    } catch (error) {
      lockVault();
      setIsUnlocked(false);
      if (error instanceof VaultlockApiError && error.status === 403) {
        setScreen("check-email");
        setScreenError("Verify your email before signing in.");
      } else if (error instanceof Error && error.message === VAULT_UNLOCK_ERROR) {
        setScreenError(VAULT_UNLOCK_ERROR);
      } else if (error instanceof Error && error.message === VAULT_LOCAL_KEYS_ERROR) {
        setScreenError(VAULT_LOCAL_KEYS_ERROR);
      } else {
        setScreenError(authErrorMessage(error, GENERIC_UNLOCK_ERROR));
      }
    } finally {
      setIsSubmitting(false);
      setLoadingMessage(null);
    }
  };

  const handleSignOut = async () => {
    resetFeedback();
    lockVault();
    setIsVaultCreateOpen(false);
    await clearAllAuthData();
    await clearAllVaultSyncTokens();
    setSession(null);
    setPendingVerificationEmail(null);
    setIsUnlocked(false);
    setScreen("sign-in");
    setScreenSuccess("Signed out.");
  };

  const handleServerChangeRequiresSignOut = async (): Promise<boolean> => {
    return window.confirm(
      "Changing the server URL will sign you out and clear local account data on this device. Continue?",
    );
  };

  const handleChangeServer = async (url: string, advanced: ServerAdvancedOptions) => {
    const urlChanged =
      serverUrl !== null && normalizeUrlForCompare(url) !== normalizeUrlForCompare(serverUrl);
    if (urlChanged && session) {
      await clearWrappedDekStorage();
      await clearAllAuthData();
      await clearAllVaultSyncTokens();
      setSession(null);
      setPendingVerificationEmail(null);
      setIsUnlocked(false);
    }

    const normalized = await connectServer(url, advanced);
    await saveServerAdvancedOptions(advanced);
    setServerUrl(normalized);
    setServerAdvanced(advanced);
    setConnectionStatus("connected");
    if (urlChanged) {
      setScreen("sign-in");
    }
  };

  const isVaultView = screen === "vault" && Boolean(session) && isUnlocked;
  const showServerIndicator = Boolean(serverUrl) && screen !== "connect" && !isVaultView;

  return (
    <TooltipProvider>
      <div className="app-shell min-h-svh bg-background text-foreground">
        <TitleBar />

        {isVaultView && session ? (
          <VaultScreen
            accessToken={session.accessToken}
            email={session.email}
            onCreateFormOpenChange={setIsVaultCreateOpen}
            onLock={() => lockVaultSession()}
            onSessionExpired={handleSessionExpired}
            onSignOut={handleSignOut}
          />
        ) : (
          <main className="flex h-[calc(100svh-2.75rem)] min-h-0 flex-1 flex-col overflow-hidden">
            {isBootstrapping ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Loading…
              </div>
            ) : (
              <AuthLayout
                headerRight={
                  showServerIndicator && serverUrl ? (
                    <ServerStatusIndicator
                      serverUrl={serverUrl}
                      status={connectionStatus}
                      advanced={serverAdvanced}
                      isAuthenticated={Boolean(session)}
                      onRecheck={() => refreshConnectionStatus(serverUrl, serverAdvanced)}
                      onChangeServer={handleChangeServer}
                      onServerChangeRequiresSignOut={handleServerChangeRequiresSignOut}
                    />
                  ) : undefined
                }
              >
                {screen === "connect" && (
                  <ConnectServerScreen
                    initialUrl=""
                    initialAdvanced={serverAdvanced}
                    isSubmitting={isSubmitting}
                    error={screenError}
                    onConnect={handleConnect}
                  />
                )}

                {screen === "register" && (
                  <RegisterScreen
                    initialEmail={registerEmailDraft}
                    isSubmitting={isSubmitting}
                    error={screenError}
                    onRegister={handleRegister}
                    onGoToSignIn={() => {
                      resetFeedback();
                      setScreen("sign-in");
                    }}
                  />
                )}

                {screen === "sign-in" && (
                  <SignInScreen
                    initialEmail={signInEmailDraft || pendingVerificationEmail || ""}
                    isSubmitting={isSubmitting}
                    error={screenError}
                    onSignIn={handleSignIn}
                    onGoToRegister={() => {
                      resetFeedback();
                      setScreen("register");
                    }}
                    onGoToVerify={() => {
                      resetFeedback();
                      setScreen("check-email");
                    }}
                    hasPendingVerification={Boolean(pendingVerificationEmail)}
                  />
                )}

                {screen === "check-email" && pendingVerificationEmail && (
                  <CheckEmailScreen
                    email={pendingVerificationEmail}
                    isSubmitting={isSubmitting}
                    error={screenError}
                    success={screenSuccess}
                    onVerify={handleVerify}
                    onGoToSignIn={() => {
                      resetFeedback();
                      setScreen("sign-in");
                    }}
                  />
                )}

                {screen === "unlock" && session && (
                  <UnlockScreen
                    email={session.email}
                    isSubmitting={isSubmitting}
                    error={screenError}
                    success={screenSuccess}
                    onUnlock={handleUnlock}
                    onSignOut={handleSignOut}
                  />
                )}

                {screen === "vault" && session && !isUnlocked && (
                  <UnlockScreen
                    email={session.email}
                    isSubmitting={isSubmitting}
                    error={screenError}
                    success={screenSuccess}
                    onUnlock={handleUnlock}
                    onSignOut={handleSignOut}
                  />
                )}
              </AuthLayout>
            )}
          </main>
        )}

        {loadingMessage && <LoadingOverlay message={loadingMessage} />}
      </div>
    </TooltipProvider>
  );
}

function normalizeUrlForCompare(input: string): string {
  try {
    const candidate = /^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`;
    return new URL(candidate).origin;
  } catch {
    return input.trim();
  }
}

export default App;
