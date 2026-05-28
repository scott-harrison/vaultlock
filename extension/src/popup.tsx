import type { LoginItemPlaintext, NoteItemPlaintext } from "@vaultlock/shared/types";
import { useCallback, useEffect, useState } from "react";
import { getAuthSession, loginAndUnlock, logout } from "./lib/auth";
import { getServerSettings } from "./lib/storage";
import { isVaultUnlocked, lockVault } from "./lib/vaultSession";

type AuthState = "loading" | "needs-server" | "login" | "unlock" | "unlocked";

function VaultListView({ onLock, onLogout }: { onLock: () => void; onLogout: () => void }) {
  const [items, setItems] = useState<import("./lib/vaultItems").DecryptedVaultItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const loadItems = useCallback(async (useSince = true) => {
    setLoading(true);
    setError(null);

    try {
      const { fetchAndDecryptVaultItems, sortVaultItems } = await import("./lib/vaultItems");
      const { getVaultSyncToken, saveVaultSyncToken } = await import("./lib/storage");

      const since = useSince ? await getVaultSyncToken() : undefined;
      const result = await fetchAndDecryptVaultItems(since ?? undefined);

      if (result.syncToken) {
        await saveVaultSyncToken(result.syncToken);
      }

      setItems(sortVaultItems(result.items));
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
        <button type="button" onClick={() => loadItems(false)} title="Refresh">
          ↻
        </button>
        <button type="button" onClick={onLock}>
          Lock
        </button>
        <button type="button" onClick={onLogout}>
          Sign out
        </button>
      </div>

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
  // biome-ignore lint/suspicious/noExplicitAny: will be properly typed when messaging is expanded in 12-07
  const [pendingFillRequest, setPendingFillRequest] = useState<any>(null);

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
          chrome.runtime.sendMessage({ type: "GET_PENDING_FILL_REQUEST" }).then((request) => {
            if (request) {
              setPendingFillRequest(request);
              console.log("[VaultLock Popup] Pending fill request received:", request);
              // In a full 12-07 implementation we would filter vault items by hostname here
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlock failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLock = async () => {
    await lockVault();
    setAuthState("unlock");
  };

  const handleLogout = async () => {
    await logout();
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
              <strong>Fill request from this page:</strong> {pendingFillRequest.hostname}
              <br />
              <small>Matching vault items will appear below (full matching in 12-07)</small>
            </div>
          )}
          <VaultListView onLock={handleLock} onLogout={handleLogout} />
        </>
      )}
    </div>
  );
}
