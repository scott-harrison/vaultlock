import "./extension-ui.css";
import { FillRequestBanner } from "./popup/components/FillRequestBanner";
import { LoadingState } from "./popup/components/LoadingState";
import { LoginForm } from "./popup/components/LoginForm";
import { NeedsServerState } from "./popup/components/NeedsServerState";
import { PopupHeader } from "./popup/components/PopupHeader";
import { PopupShell } from "./popup/components/PopupShell";
import { UnlockForm } from "./popup/components/UnlockForm";
import { VaultListView } from "./popup/components/VaultListView";
import { useAuthState } from "./popup/hooks/useAuthState";

export default function IndexPopup() {
  const {
    authState,
    email,
    masterPassword,
    serverUrl,
    isSubmitting,
    error,
    pendingFillRequest,
    setEmail,
    setMasterPassword,
    setPendingFillRequest,
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
        onMasterPasswordChange={setMasterPassword}
        onSubmit={handleUnlock}
        onSignOut={() => handleLogout(() => {})}
      />
    );
  }

  return (
    <PopupShell>
      <PopupHeader serverUrl={serverUrl} />
      {pendingFillRequest ? <FillRequestBanner hostname={pendingFillRequest.hostname} /> : null}
      <VaultListView
        pendingFillRequest={pendingFillRequest}
        onLock={handleLock}
        onLogout={handleLogout}
        onFillComplete={() => setPendingFillRequest(null)}
      />
    </PopupShell>
  );
}
