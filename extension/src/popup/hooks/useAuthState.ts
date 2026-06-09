import { useCallback, useEffect, useState } from "react";
import type { AutofillRequest, SaveLoginCandidate } from "../../lib/messaging";
import { getServerSettings, isServerConfigured } from "../../lib/storage";

export type AuthState = "loading" | "needs-server" | "login" | "unlock" | "unlocked";

export function useAuthState() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [email, setEmail] = useState("");
  const [masterPassword, setMasterPassword] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [pendingFillRequest, setPendingFillRequest] = useState<AutofillRequest | null>(null);
  const [pendingSaveLogin, setPendingSaveLogin] = useState<SaveLoginCandidate | null>(null);

  const loadPendingRequests = useCallback(async () => {
    const [fillRequest, saveRequest] = await Promise.all([
      chrome.runtime.sendMessage({ type: "GET_PENDING_FILL_REQUEST" }).catch(() => null),
      chrome.runtime.sendMessage({ type: "GET_PENDING_SAVE_LOGIN" }).catch(() => null),
    ]);

    setPendingFillRequest(fillRequest ? (fillRequest as AutofillRequest) : null);
    setPendingSaveLogin(saveRequest ? (saveRequest as SaveLoginCandidate) : null);
  }, []);

  const resolveAuthState = useCallback(async () => {
    try {
      const settings = await getServerSettings();
      setServerUrl(settings.serverUrl);

      if (!isServerConfigured(settings)) {
        setAuthState("needs-server");
        return;
      }

      const [{ getAuthSession }, { isVaultUnlocked }] = await Promise.all([
        import("../../lib/auth"),
        import("../../lib/vaultSession"),
      ]);

      const session = await getAuthSession();
      if (!session) {
        setAuthState("login");
        return;
      }

      if (isVaultUnlocked()) {
        const { persistVaultUnlockSession } = await import("../../lib/vaultUnlockSession");
        const { syncVaultDekToBackground } = await import("../../lib/vaultDekSync");
        void persistVaultUnlockSession(true);
        void syncVaultDekToBackground();
        setAuthState("unlocked");
        await loadPendingRequests();
      } else {
        await loadPendingRequests();
        setEmail(session.email);
        setAuthState("unlock");
      }
    } catch (err) {
      console.error(err);
      setAuthState("login");
    }
  }, [loadPendingRequests]);

  useEffect(() => {
    document.getElementById("__plasmo-fallback")?.remove();
    resolveAuthState();
  }, [resolveAuthState]);

  useEffect(() => {
    const onMessage = (message: unknown) => {
      const msg = message as { type?: string };
      if (msg.type !== "REQUEST_VAULT_DEK_SYNC") {
        return;
      }

      void import("../../lib/vaultDekSync").then(({ syncVaultDekToBackground }) => {
        void syncVaultDekToBackground();
      });
    };

    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, []);

  useEffect(() => {
    const onStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== "local" || !changes.server_settings) {
        return;
      }
      resolveAuthState();
    };

    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => chrome.storage.onChanged.removeListener(onStorageChanged);
  }, [resolveAuthState]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const { loginAndUnlock } = await import("../../lib/auth");
      await loginAndUnlock({ email, masterPassword });
      setMasterPassword("");
      setAuthState("unlocked");
      await loadPendingRequests();
      const { syncVaultDekToBackground } = await import("../../lib/vaultDekSync");
      void syncVaultDekToBackground();
      void chrome.runtime
        .sendMessage({ type: "TRIGGER_VAULT_SYNC", forceFull: true })
        .catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const { getAuthSession, loginAndUnlock } = await import("../../lib/auth");
      const session = await getAuthSession();
      if (!session) throw new Error("No session found");

      await loginAndUnlock({
        email: session.email,
        masterPassword,
      });

      setMasterPassword("");
      setAuthState("unlocked");
      await loadPendingRequests();
      const { syncVaultDekToBackground } = await import("../../lib/vaultDekSync");
      void syncVaultDekToBackground();
      void chrome.runtime
        .sendMessage({ type: "TRIGGER_VAULT_SYNC", forceFull: true })
        .catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlock failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearPendingSaveLogin = useCallback(async () => {
    setPendingSaveLogin(null);
    await chrome.runtime.sendMessage({ type: "CLEAR_PENDING_SAVE_LOGIN" }).catch(() => {});
  }, []);

  const handleLock = async (clearVaultItems: () => void) => {
    const { lockVault } = await import("../../lib/vaultSession");
    await lockVault();
    chrome.runtime.sendMessage({ type: "VAULT_LOCKED" }).catch(() => {});
    clearVaultItems();
    setPendingSaveLogin(null);
    setAuthState("unlock");
  };

  const handleLogout = async (clearVaultItems: () => void) => {
    const { logout } = await import("../../lib/auth");
    await logout();
    chrome.runtime.sendMessage({ type: "VAULT_LOCKED" }).catch(() => {});
    clearVaultItems();
    setEmail("");
    setMasterPassword("");
    setPendingSaveLogin(null);
    setAuthState("login");
  };

  return {
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
  };
}
