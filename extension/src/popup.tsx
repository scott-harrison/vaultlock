import { useEffect } from "react";
import "./extension-ui.css";
import { applyExtensionTheme } from "./lib/extensionTheme";
import { LoadingState } from "./popup/components/LoadingState";
import { LoginForm } from "./popup/components/LoginForm";
import { NeedsServerState } from "./popup/components/NeedsServerState";
import { PopupHeader } from "./popup/components/PopupHeader";
import { PopupShell } from "./popup/components/PopupShell";
import { SaveLoginForm } from "./popup/components/SaveLoginForm";
import { UnlockForm } from "./popup/components/UnlockForm";
import { VaultListView } from "./popup/components/VaultListView";
import { useAuthState } from "./popup/hooks/useAuthState";

export default function IndexPopup() {
  useEffect(() => {
    applyExtensionTheme();
  }, []);

  const {
    authState,
    email,
    masterPassword,
    serverUrl,
    isSubmitting,
    error,
    pendingFillRequest,
    pendingSaveLogin,
    setEmail,
    setMasterPassword,
    setPendingFillRequest,
    clearPendingSaveLogin,
    handleLogin,
    handleUnlock,
    handleLock,
    handleLogout,
  } = useAuthState();

  if (authState === "loading") {
    return <LoadingState />;
  }

  if (authState === "needs-server") {
    return <NeedsServerState />;
  }

  if (authState === "unlocked" && pendingSaveLogin) {
    return (
      <SaveLoginForm
        serverUrl={serverUrl}
        candidate={pendingSaveLogin}
        onCancel={() => {
          void clearPendingSaveLogin();
        }}
        onSaved={() => {
          void clearPendingSaveLogin();
        }}
      />
    );
  }

  if (authState === "login") {
    return (
      <LoginForm
        serverUrl={serverUrl}
        email={email}
        masterPassword={masterPassword}
        isSubmitting={isSubmitting}
        error={error}
        onEmailChange={setEmail}
        onMasterPasswordChange={setMasterPassword}
        onSubmit={handleLogin}
      />
    );
  }

  if (authState === "unlock") {
    return (
      <UnlockForm
        serverUrl={serverUrl}
        email={email}
        masterPassword={masterPassword}
        isSubmitting={isSubmitting}
        error={error}
        savePromptHostname={pendingSaveLogin?.hostname}
        onMasterPasswordChange={setMasterPassword}
        onSubmit={handleUnlock}
        onSignOut={() => handleLogout(() => {})}
      />
    );
  }

  return (
    <PopupShell>
      <PopupHeader serverUrl={serverUrl} />
      <VaultListView
        pendingFillRequest={pendingFillRequest}
        onLock={handleLock}
        onLogout={handleLogout}
        onFillComplete={() => setPendingFillRequest(null)}
      />
    </PopupShell>
  );
}
