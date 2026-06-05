import { useCallback, useEffect, useState } from "react";
import type { AutofillRequest } from "../../lib/messaging";
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
        setAuthState("unlocked");
        chrome.runtime
          .sendMessage({ type: "GET_PENDING_FILL_REQUEST" })
          .then((request: unknown) => {
            if (request) {
              setPendingFillRequest(request as AutofillRequest);
            }
          });
      } else {
        setEmail(session.email);
        setAuthState("unlock");
      }
    } catch (err) {
      console.error(err);
      setAuthState("login");
    }
  }, []);

  useEffect(() => {
    document.getElementById("__plasmo-fallback")?.remove();
    resolveAuthState();
  }, [resolveAuthState]);

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
      await chrome.runtime
        .sendMessage({ type: "TRIGGER_VAULT_SYNC", forceFull: true })
        .catch(() => {});
      const request = await chrome.runtime
        .sendMessage({ type: "GET_PENDING_FILL_REQUEST" })
        .catch(() => null);
      if (request) setPendingFillRequest(request as AutofillRequest);
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
      await chrome.runtime
        .sendMessage({ type: "TRIGGER_VAULT_SYNC", forceFull: true })
        .catch(() => {});
      const request = await chrome.runtime
        .sendMessage({ type: "GET_PENDING_FILL_REQUEST" })
        .catch(() => null);
      if (request) setPendingFillRequest(request as AutofillRequest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlock failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLock = async (clearVaultItems: () => void) => {
    const { lockVault } = await import("../../lib/vaultSession");
    await lockVault();
    chrome.runtime.sendMessage({ type: "VAULT_LOCKED" }).catch(() => {});
    clearVaultItems();
    setAuthState("unlock");
  };

  const handleLogout = async (clearVaultItems: () => void) => {
    const { logout } = await import("../../lib/auth");
    await logout();
    chrome.runtime.sendMessage({ type: "VAULT_LOCKED" }).catch(() => {});
    clearVaultItems();
    setEmail("");
    setMasterPassword("");
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
    setEmail,
    setMasterPassword,
    setPendingFillRequest,
    handleLogin,
    handleUnlock,
    handleLock,
    handleLogout,
  };
}
