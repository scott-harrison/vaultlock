import type {
  LoginItemPlaintext,
  NoteItemPlaintext,
  VaultItemResponse,
} from "@vaultlock/shared/types";
import { useCallback, useEffect, useState } from "react";
import { getAuthSession, loginAndUnlock, logout } from "./lib/auth";
import { onStorageChanged } from "./lib/browser";
import { loginMatchesPageHost } from "./lib/loginHostMatch";
import type { AutofillRequest } from "./lib/messaging";
import { getServerSettings, isServerConfigured } from "./lib/storage";
import type { DecryptedVaultItem } from "./lib/vaultItems";
import { isVaultUnlocked, lockVault } from "./lib/vaultSession";

type AuthState = "loading" | "needs-server" | "login" | "unlock" | "unlocked";

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);

  if (seconds < 30) return "just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function VaultListView({
  onLock,
  onLogout,
  pendingFillRequest,
  onFillComplete,
}: {
  onLock: () => void | Promise<void>;
  onLogout: () => void | Promise<void>;
  pendingFillRequest: AutofillRequest | null;
  onFillComplete: () => void;
}) {
  const [items, setItems] = useState<import("./lib/vaultItems").DecryptedVaultItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [fillError, setFillError] = useState<string | null>(null);
  const [fillingId, setFillingId] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadFromCache = useCallback(async (): Promise<{
    encryptedCount: number;
    decryptedCount: number;
  }> => {
    const encryptedCache = await chrome.runtime
      .sendMessage({ type: "GET_ENCRYPTED_VAULT_CACHE" })
      .catch(() => null);

    if (!encryptedCache || !Array.isArray(encryptedCache.items)) {
      setItems([]);
      return { encryptedCount: 0, decryptedCount: 0 };
    }

    const encryptedItems = encryptedCache.items as VaultItemResponse[];
    const { sortVaultItems } = await import("./lib/vaultItems");
    const { decryptVaultItem } = await import("./lib/vaultCrypto");
    let decryptFailures = 0;

    const decrypted = await Promise.all(
      encryptedItems.map(async (item) => {
        try {
          const plaintext = await decryptVaultItem(item);
          return {
            id: item.id,
            itemType: item.item_type,
            createdAt: item.created_at,
            updatedAt: item.updated_at,
            plaintext,
          };
        } catch {
          decryptFailures += 1;
          return null;
        }
      }),
    ).then((arr) => arr.filter(Boolean));

    setItems(sortVaultItems(decrypted as DecryptedVaultItem[]));
    setLastSynced(
      typeof encryptedCache.updatedAt === "number" ? encryptedCache.updatedAt : Date.now(),
    );

    if (encryptedItems.length > 0 && decrypted.length === 0) {
      if (!isVaultUnlocked()) {
        setError("Vault is locked. Enter your master password to view items.");
      } else if (decryptFailures > 0) {
        setError(
          "Synced items could not be decrypted with this unlock key. " +
            "The extension may have stored a different encryption key than your desktop vault. " +
            "Unlock once in the VaultLock desktop app (this restores the server key), then sign out here, clear extension data, and sign in again.",
        );
      }
    }

    return { encryptedCount: encryptedItems.length, decryptedCount: decrypted.length };
  }, []);

  const refreshFromServer = useCallback(
    async (forceFull = false) => {
      setIsSyncing(true);
      setError(null);
      try {
        const result = await chrome.runtime.sendMessage({
          type: "TRIGGER_VAULT_SYNC",
          forceFull,
        });
        if (result && typeof result === "object" && "success" in result && !result.success) {
          throw new Error(
            "error" in result && typeof result.error === "string"
              ? result.error
              : "Vault sync failed",
          );
        }
        await loadFromCache();
      } catch (err) {
        console.error("Vault sync failed", err);
        setError(err instanceof Error ? err.message : "Failed to sync vault items.");
      } finally {
        setIsSyncing(false);
      }
    },
    [loadFromCache],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const { encryptedCount, decryptedCount } = await loadFromCache();
        if (!cancelled && encryptedCount === 0 && decryptedCount === 0) {
          await refreshFromServer(true);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load vault items", err);
          setError("Failed to load vault items. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadFromCache, refreshFromServer]);

  useEffect(() => {
    const handleMessage = (message: unknown) => {
      const msg = message as { type?: string };
      if (msg.type === "ENCRYPTED_VAULT_CACHE_UPDATED") {
        void loadFromCache();
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [loadFromCache]);

  const filtered = items.filter((item) => {
    const term = search.toLowerCase();
    const title = (item.plaintext?.title || "").toLowerCase();
    const username =
      item.itemType === "login"
        ? ((item.plaintext as LoginItemPlaintext).username || "").toLowerCase()
        : "";
    const content =
      item.itemType === "note"
        ? ((item.plaintext as NoteItemPlaintext).content || "").toLowerCase()
        : "";
    const matchesSearch = title.includes(term) || username.includes(term) || content.includes(term);
    if (!matchesSearch) return false;

    if (pendingFillRequest && item.itemType === "login") {
      const login = item.plaintext as LoginItemPlaintext;
      return loginMatchesPageHost(login.url, pendingFillRequest.hostname);
    }

    return true;
  });

  const handleFill = async (login: LoginItemPlaintext, itemId: string) => {
    if (!pendingFillRequest) return;
    setFillError(null);
    setFillingId(itemId);

    try {
      const result = await chrome.runtime.sendMessage({
        type: "EXECUTE_FILL",
        hostname: pendingFillRequest.hostname,
        fieldType: pendingFillRequest.fieldType,
        associatedFieldId: pendingFillRequest.associatedFieldId,
        username: login.username ?? "",
        password: login.password ?? "",
      });

      if (!result || typeof result !== "object" || !("success" in result) || !result.success) {
        const err =
          result &&
          typeof result === "object" &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Could not fill fields on the page";
        throw new Error(err);
      }

      onFillComplete();
      window.close();
    } catch (err) {
      setFillError(err instanceof Error ? err.message : "Fill failed");
    } finally {
      setFillingId(null);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1200);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  if (loading) {
    return <div style={{ padding: 16, fontSize: 13 }}>Loading vault…</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, padding: "4px 6px", fontSize: 13 }}
        />
        <button
          type="button"
          onClick={() => refreshFromServer(false)}
          disabled={isSyncing}
          title="Sync with server"
        >
          {isSyncing ? "…" : "↻"}
        </button>
        <button
          type="button"
          onClick={async () => {
            setItems([]);
            await onLock();
          }}
        >
          Lock
        </button>
        <button
          type="button"
          onClick={async () => {
            setItems([]);
            await onLogout();
          }}
        >
          Sign out
        </button>
      </div>

      {lastSynced && (
        <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>
          Last synced: {formatRelativeTime(lastSynced)}
        </div>
      )}

      {error && (
        <p style={{ color: "#b91c1c", fontSize: 12, marginBottom: 8, whiteSpace: "pre-line" }}>
          {error}
        </p>
      )}

      {fillError && <p style={{ color: "#b91c1c", fontSize: 12, marginBottom: 8 }}>{fillError}</p>}

      {filtered.length === 0 && !error && (
        <p style={{ fontSize: 13, color: "#666", padding: "8px 0" }}>
          {search ? "No matches found." : "No items yet."}
        </p>
      )}

      <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 13 }}>
        {filtered.map((item) => {
          const p = item.plaintext;
          const isLogin = item.itemType === "login";
          const isNote = item.itemType === "note";

          return (
            <li key={item.id} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
              <div style={{ fontWeight: 500, marginBottom: 2 }}>
                {isLogin
                  ? (p as LoginItemPlaintext).title ||
                    (p as LoginItemPlaintext).username ||
                    (p as LoginItemPlaintext).url ||
                    "Untitled"
                  : isNote
                    ? (p as NoteItemPlaintext).title || "Note"
                    : (p as import("@vaultlock/shared/types").CardItemPlaintext).title || "Item"}
              </div>

              {isLogin && (
                <div style={{ color: "#555", marginTop: 4 }}>
                  {(p as LoginItemPlaintext).username && (
                    <>
                      {(p as LoginItemPlaintext).username}{" "}
                      <button
                        type="button"
                        onClick={() => {
                          const u = (p as LoginItemPlaintext).username;
                          if (u) copyToClipboard(u, "user");
                        }}
                        style={{ fontSize: 10, padding: "0 3px" }}
                      >
                        {copied === "user" ? "Copied!" : "Copy"}
                      </button>
                    </>
                  )}
                  {(p as LoginItemPlaintext).password && (
                    <>
                      {" "}
                      <button
                        type="button"
                        onClick={() => {
                          const pw = (p as LoginItemPlaintext).password;
                          if (pw) copyToClipboard(pw, "pass");
                        }}
                        style={{ fontSize: 10, padding: "0 3px" }}
                      >
                        {copied === "pass" ? "Copied!" : "Copy pass"}
                      </button>
                    </>
                  )}
                  {pendingFillRequest && (p as LoginItemPlaintext).password && (
                    <>
                      {" "}
                      <button
                        type="button"
                        disabled={fillingId === item.id}
                        onClick={() => handleFill(p as LoginItemPlaintext, item.id)}
                        style={{
                          fontSize: 10,
                          padding: "2px 6px",
                          fontWeight: 600,
                          background: "#2563eb",
                          color: "#fff",
                          border: "none",
                          borderRadius: 3,
                          cursor: fillingId === item.id ? "wait" : "pointer",
                        }}
                      >
                        {fillingId === item.id ? "Filling…" : "Fill"}
                      </button>
                    </>
                  )}
                </div>
              )}

              {isNote && (p as NoteItemPlaintext).content && (
                <div style={{ color: "#555", whiteSpace: "pre-wrap", fontSize: 12 }}>
                  {((p as NoteItemPlaintext).content?.length ?? 0) > 120
                    ? `${(p as NoteItemPlaintext).content?.slice(0, 120) ?? ""}…`
                    : (p as NoteItemPlaintext).content}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function IndexPopup() {
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
    resolveAuthState();
  }, [resolveAuthState]);

  useEffect(() => {
    return onStorageChanged((changes, areaName) => {
      if (areaName !== "local" || !changes.server_settings) {
        return;
      }
      resolveAuthState();
    });
  }, [resolveAuthState]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
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

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
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

  const handleLock = async () => {
    await lockVault();
    // Notify background (security: background clears encrypted cache on lock)
    chrome.runtime.sendMessage({ type: "VAULT_LOCKED" }).catch(() => {});
    setAuthState("unlock");
  };

  const handleLogout = async () => {
    await logout();
    chrome.runtime.sendMessage({ type: "VAULT_LOCKED" }).catch(() => {});
    setEmail("");
    setMasterPassword("");
    setAuthState("login");
  };

  if (authState === "loading") {
    return <div style={{ padding: 16 }}>Loading…</div>;
  }

  if (authState === "needs-server") {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui" }}>
        <h3>VaultLock</h3>
        <p>Please configure your server URL first.</p>
        <button type="button" onClick={() => chrome.runtime.openOptionsPage()}>
          Open Settings
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: 320, padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>VaultLock</h2>
      <p style={{ margin: "4px 0 12px", color: "#666", fontSize: 13 }}>{serverUrl}</p>

      {error && <p style={{ color: "red", fontSize: 12 }}>{error}</p>}

      {authState === "login" && (
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", marginBottom: 8 }}
          />
          <input
            type="password"
            placeholder="Master Password"
            value={masterPassword}
            onChange={(e) => setMasterPassword(e.target.value)}
            required
            style={{ width: "100%", marginBottom: 12 }}
          />
          <button type="submit" disabled={isSubmitting} style={{ width: "100%" }}>
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      )}

      {authState === "unlock" && (
        <form onSubmit={handleUnlock}>
          <p style={{ fontSize: 13 }}>Welcome back, {email}</p>
          <input
            type="password"
            placeholder="Master Password"
            value={masterPassword}
            onChange={(e) => setMasterPassword(e.target.value)}
            required
            style={{ width: "100%", marginBottom: 12 }}
          />
          <button type="submit" disabled={isSubmitting} style={{ width: "100%", marginBottom: 8 }}>
            {isSubmitting ? "Unlocking..." : "Unlock Vault"}
          </button>
          <button type="button" onClick={handleLogout} style={{ width: "100%" }}>
            Sign out
          </button>
        </form>
      )}

      {authState === "unlocked" && (
        <>
          {pendingFillRequest && (
            <div
              style={{
                background: "#fef3c7",
                border: "1px solid #f59e0b",
                padding: 8,
                borderRadius: 4,
                marginBottom: 8,
                fontSize: 12,
              }}
            >
              <strong>Login form detected on {pendingFillRequest.hostname}.</strong>
              <div style={{ marginTop: 4, fontSize: 11, color: "#92400e" }}>
                Choose a matching login and click <strong>Fill</strong>.
              </div>
            </div>
          )}
          <VaultListView
            onLock={handleLock}
            onLogout={handleLogout}
            pendingFillRequest={pendingFillRequest}
            onFillComplete={() => setPendingFillRequest(null)}
          />
        </>
      )}
    </div>
  );
}
