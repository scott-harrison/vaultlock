import { useEffect, useState } from "react";
import "./extension-ui.css";
import {
  DEFAULT_SERVER_ADVANCED,
  type ServerAdvancedOptions,
  loadServerSettingsWithAdvanced,
  normalizeServerBaseUrl,
  saveServerConnection,
  testServerConnection,
} from "./lib/serverSettings";
import type { LastConnectionStatus } from "./lib/storage";

export default function OptionsPage() {
  const [serverUrl, setServerUrl] = useState("");
  const [advanced, setAdvanced] = useState<ServerAdvancedOptions>(DEFAULT_SERVER_ADVANCED);
  const [lastStatus, setLastStatus] = useState<LastConnectionStatus | null>(null);

  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [currentTestResult, setCurrentTestResult] = useState<"idle" | "success" | "error">("idle");
  const [currentError, setCurrentError] = useState("");

  const [saveMessage, setSaveMessage] = useState("");

  const normalizedUrl = serverUrl ? normalizeServerBaseUrl(serverUrl) : "";

  useEffect(() => {
    loadServerSettingsWithAdvanced().then(({ url, advanced: adv, lastStatus: status }) => {
      setServerUrl(url);
      setAdvanced(adv);
      setLastStatus(status ?? null);
    });
  }, []);

  const validateUrl = (): boolean => {
    if (!serverUrl.trim()) {
      setCurrentError("Please enter a server URL");
      return false;
    }
    return true;
  };

  const handleTest = async () => {
    if (!validateUrl()) return;

    setIsTesting(true);
    setCurrentTestResult("idle");
    setCurrentError("");
    setSaveMessage("");

    try {
      const result = await testServerConnection(serverUrl, advanced);
      setCurrentTestResult(result.success ? "success" : "error");
      if (!result.success) {
        setCurrentError(result.error || "Connection test failed");
      }

      // Refresh last known status from storage
      const fresh = await loadServerSettingsWithAdvanced();
      setLastStatus(fresh.lastStatus ?? null);
    } catch (err) {
      setCurrentTestResult("error");
      setCurrentError(err instanceof Error ? err.message : "Connection test failed");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!validateUrl()) return;

    setIsSaving(true);
    setSaveMessage("");
    setCurrentError("");

    try {
      await saveServerConnection(serverUrl, advanced);
      setSaveMessage("Settings saved successfully.");

      const fresh = await loadServerSettingsWithAdvanced();
      setLastStatus(fresh.lastStatus ?? null);
    } catch (err) {
      setCurrentError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setServerUrl("http://localhost:8080");
    setAdvanced(DEFAULT_SERVER_ADVANCED);
    setCurrentTestResult("idle");
    setCurrentError("");
    setSaveMessage("");
  };

  const getStatusDisplay = () => {
    if (currentTestResult === "success") {
      return { text: "✅ Connected (just tested)", color: "green" };
    }
    if (currentTestResult === "error") {
      return { text: "❌ Connection failed (just tested)", color: "red" };
    }
    if (lastStatus) {
      const time = new Date(lastStatus.timestamp).toLocaleTimeString();
      return {
        text: lastStatus.success
          ? `✅ Last successful connection at ${time}`
          : `❌ Last failed at ${time}`,
        color: lastStatus.success ? "green" : "red",
      };
    }
    return { text: "Not tested yet", color: "#666" };
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="min-h-screen max-w-xl bg-background p-8 font-sans text-foreground">
      <h1>VaultLock Extension Settings</h1>

      <section style={{ marginTop: 24 }}>
        <h2>Server Connection</h2>

        <div style={{ marginBottom: 20, padding: 12, background: "#f8f8f8", borderRadius: 6 }}>
          <strong>Status:</strong>{" "}
          <span style={{ color: statusDisplay.color }}>{statusDisplay.text}</span>
          {normalizedUrl && (
            <div style={{ marginTop: 4, fontSize: 13, color: "#555" }}>
              Normalized: <code>{normalizedUrl}</code>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="server-url"
            style={{ display: "block", marginBottom: 4, fontWeight: 500 }}
          >
            Server URL
          </label>
          <input
            id="server-url"
            type="text"
            value={serverUrl}
            onChange={(e) => {
              setServerUrl(e.target.value);
              setCurrentTestResult("idle");
              setCurrentError("");
            }}
            placeholder="https://your-vault.example.com"
            style={{ width: "100%", padding: 8, fontSize: 14 }}
          />
        </div>

        <details style={{ marginBottom: 16 }}>
          <summary style={{ cursor: "pointer", fontWeight: 500, marginBottom: 8 }}>
            Advanced Settings
          </summary>

          <div style={{ marginTop: 12 }}>
            <label
              htmlFor="request-timeout"
              style={{ display: "block", marginBottom: 4, fontWeight: 500 }}
            >
              Request Timeout (ms)
            </label>
            <input
              id="request-timeout"
              type="number"
              value={advanced.requestTimeoutMs}
              onChange={(e) =>
                setAdvanced((prev) => ({
                  ...prev,
                  requestTimeoutMs: Number(e.target.value),
                }))
              }
              style={{ width: "100%", padding: 8, fontSize: 14 }}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={advanced.allowInsecureHttp}
                onChange={(e) =>
                  setAdvanced((prev) => ({
                    ...prev,
                    allowInsecureHttp: e.target.checked,
                  }))
                }
              />
              Allow insecure HTTP connections (not recommended for production)
            </label>
          </div>
        </details>

        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting || isSaving || !serverUrl}
            style={{ padding: "8px 16px" }}
          >
            {isTesting ? "Testing..." : "Test Connection"}
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isTesting || !serverUrl}
            style={{ padding: "8px 16px" }}
          >
            {isSaving ? "Saving..." : "Save Settings"}
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={isTesting || isSaving}
            style={{ padding: "8px 16px" }}
          >
            Reset to defaults
          </button>
        </div>

        {currentTestResult === "success" && (
          <p style={{ color: "green", marginTop: 10 }}>✅ Connection successful</p>
        )}
        {currentTestResult === "error" && currentError && (
          <p style={{ color: "red", marginTop: 10 }}>{currentError}</p>
        )}
        {saveMessage && <p style={{ color: "green", marginTop: 10 }}>{saveMessage}</p>}
      </section>

      <p style={{ marginTop: 40, fontSize: 13, color: "#666" }}>
        These settings are stored locally in your browser. The extension will use them for all
        future requests.
      </p>
    </div>
  );
}
