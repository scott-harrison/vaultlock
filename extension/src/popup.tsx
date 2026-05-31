import { useCallback, useEffect, useState } from "react";
import { getAuthSession, loginAndUnlock, logout } from "./lib/auth";
import type { AutofillRequest } from "./lib/messaging";
import { getServerSettings } from "./lib/storage";
import type {
  DecryptedVaultItem,
  LoginItemPlaintext,
  NoteItemPlaintext,
  VaultItemResponse,
} from "./lib/vaultItems";
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

function VaultListView({ onLock, onLogout }: { onLock: () => void; onLogout: () => void }) {
  const [items, setItems] = useState<import("./lib/vaultItems").DecryptedVaultItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<number | null>(null); // timestamp of last successful background sync

  const loadItems = useCallback(async (useSince = true) => {
    setLoading(true);
    setError(null);

    try {
      // Fast path: ask background for encrypted cache (populated by background incremental sync)
      const encryptedCache = await chrome.runtime
        .sendMessage({ type: "GET_ENCRYPTED_VAULT_CACHE" })
        .catch(() => null);

      if (
        encryptedCache &&
        Array.isArray(encryptedCache.items) &&
        encryptedCache.items.length > 0
      ) {
        // Decrypt locally in the popup (where we have the DEK after unlock)
        const { sortVaultItems } = await import("./lib/vaultItems");
        const { decryptVaultItem } = await import("./lib/vaultCrypto");
        const decrypted = await Promise.all(
          (encryptedCache.items as VaultItemResponse[]).map(async (item) => {
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
              return null;
            }
          }),
        ).then((arr) => arr.filter(Boolean));

        setItems(sortVaultItems(decrypted as DecryptedVaultItem[]));
        setLastSynced(Date.now());
        setLoading(false);

        // Trigger background to fetch any newer deltas (non-blocking)
        chrome.runtime.sendMessage({ type: "TRIGGER_VAULT_SYNC" }).catch(() => {});
        return;
      }

      // Slow path: direct fetch + decrypt
      const { fetchAndDecryptVaultItems, sortVaultItems } = await import("./lib/vaultItems");
      const { getVaultSyncToken, saveVaultSyncToken } = await import("./lib/storage");

      const since = useSince ? await getVaultSyncToken() : undefined;
      const result = await fetchAndDecryptVaultItems(since ?? undefined);

      if (result.syncToken) {
        await saveVaultSyncToken(result.syncToken);
      }

      setItems(sortVaultItems(result.items));
      setLastSynced(Date.now());
    } catch (err) {
      console.error("Failed to load vault items", err);
      setError("Failed to load vault items. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Listen for background incremental sync updates while the popup is open (12-08)
  useEffect(() => {
    const handleMessage = (message: unknown) => {
      const msg = message as { type?: string; itemCount?: number };
      if (msg.type === "ENCRYPTED_VAULT_CACHE_UPDATED") {
        setLastSynced(Date.now());
        // Re-run load which will pick up the latest encrypted cache and decrypt
        loadItems();
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [loadItems]);

  const filtered = items.filter((item) => {
    const term = search.toLowerCase();
    const title = (item.plaintext?.title || "").toLowerCase();
    const username = (item.plaintext?.username || "").toLowerCase();
    const content =
      item.itemType === "note"
        ? ((item.plaintext as NoteItemPlaintext).content || "").toLowerCase()
        : "";
    return title.includes(term) || username.includes(term) || content.includes(term);
  });

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
          onClick={async () => {
            // Explicitly trigger background incremental sync, then reload UI
            await chrome.runtime.sendMessage({ type: "TRIGGER_VAULT_SYNC" }).catch(() => {});
            loadItems(false);
          }}
          title="Sync with server"
        >
          ↻
        </button>
        <button type="button" onClick={onLock}>
          Lock
        </button>
        <button type="button" onClick={onLogout}>
          Sign out
        </button>
      </div>

      {lastSynced && (
        <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>
          Last synced: {formatRelativeTime(lastSynced)}
        </div>
      )}

      {error && <p style={{ color: "red", fontSize: 12, marginBottom: 8 }}>{error}</p>}

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

              {isLogin && (p as LoginItemPlaintext).username && (
                <div style={{ color: "#555" }}>
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

  useEffect(() => {
    async function init() {
      try {
        const settings = await getServerSettings();
        setServerUrl(settings.serverUrl);

        if (!settings.serverUrl || settings.serverUrl === "http://localhost:8080") {
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

          // Check if the background sent us a fill request (from content script indicator click)
          chrome.runtime
            .sendMessage({ type: "GET_PENDING_FILL_REQUEST" })
            .then((request: unknown) => {
              if (request) {
                setPendingFillRequest(request as AutofillRequest);
              }
            });
        } else {
          // User is logged in but vault is locked → show unlock screen
          setEmail(session.email);
          setAuthState("unlock");
        }
      } catch (err) {
        console.error(err);
        setAuthState("login");
      }
    }

    init();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      await loginAndUnlock({ email, masterPassword });
      setMasterPassword("");
      setAuthState("unlocked");
      // Kick off background incremental sync now that we have the DEK
      chrome.runtime.sendMessage({ type: "TRIGGER_VAULT_SYNC" }).catch(() => {});
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
      // Kick off background incremental sync now that we have the DEK
      chrome.runtime.sendMessage({ type: "TRIGGER_VAULT_SYNC" }).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlock failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLock = async () => {
    await lockVault();
    // Notify background + clear local decrypted state (security)
    chrome.runtime.sendMessage({ type: "VAULT_LOCKED" }).catch(() => {});
    setItems([]);
    setAuthState("unlock");
  };

  const handleLogout = async () => {
    await logout();
    // Notify background + clear local decrypted state (security)
    chrome.runtime.sendMessage({ type: "VAULT_LOCKED" }).catch(() => {});
    setItems([]);
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
                Select credentials below to fill (autofill support in progress).
              </div>
            </div>
          )}
          <VaultListView onLock={handleLock} onLogout={handleLogout} />
        </>
      )}
    </div>
  );
}
