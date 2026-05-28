import { useEffect, useState } from "react";
import { getAuthSession, loginAndUnlock, logout } from "./lib/auth";
import { getServerSettings } from "./lib/storage";
import { isVaultUnlocked, lockVault } from "./lib/vaultSession";

type AuthState = "loading" | "needs-server" | "login" | "unlock" | "unlocked";

function VaultListView({ onLock, onLogout }: { onLock: () => void; onLogout: () => void }) {
  const [items, setItems] = useState<import("./lib/vaultItems").DecryptedVaultItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Basic fetch (no incremental sync yet — will improve in later sub-tasks)
        const { fetchAndDecryptVaultItems, sortVaultItems } = await import("./lib/vaultItems");
        const decrypted = await fetchAndDecryptVaultItems();
        setItems(sortVaultItems(decrypted));
      } catch (err) {
        console.error("Failed to load vault items", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = items.filter((item) => {
    const term = search.toLowerCase();
    const title = (item.plaintext?.title || "").toLowerCase();
    const username = (item.plaintext?.username || "").toLowerCase();
    return title.includes(term) || username.includes(term);
  });

  const copy = async (text?: string) => {
    if (text) await navigator.clipboard.writeText(text);
  };

  if (loading) {
    return <div style={{ padding: 16 }}>Loading vault…</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, padding: 4 }}
        />
        <button type="button" onClick={onLock}>
          Lock
        </button>
        <button type="button" onClick={onLogout}>
          Sign out
        </button>
      </div>

      {filtered.length === 0 && <p style={{ fontSize: 13, color: "#666" }}>No items found.</p>}

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {filtered.map((item) => (
          <li key={item.id} style={{ padding: "6px 0", borderBottom: "1px solid #eee" }}>
            <div style={{ fontWeight: 500 }}>{item.plaintext?.title || "Untitled"}</div>
            {item.itemType === "login" && item.plaintext?.username && (
              <div style={{ fontSize: 12, color: "#555" }}>
                {item.plaintext.username}
                <button
                  type="button"
                  onClick={() => copy(item.plaintext.username)}
                  style={{ marginLeft: 6, fontSize: 10 }}
                >
                  Copy user
                </button>
                {item.plaintext.password && (
                  <button
                    type="button"
                    onClick={() => copy(item.plaintext.password)}
                    style={{ marginLeft: 4, fontSize: 10 }}
                  >
                    Copy pass
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
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

      {authState === "unlocked" && <VaultListView onLock={handleLock} onLogout={handleLogout} />}
    </div>
  );
}
