import { useEffect, useState } from "react";
import {
  DEFAULT_SERVER_ADVANCED,
  type ServerAdvancedOptions,
  loadServerSettingsWithAdvanced,
  saveServerConnection,
  testServerConnection,
} from "./lib/serverSettings";

export default function OptionsPage() {
  const [serverUrl, setServerUrl] = useState("");
  const [advanced, setAdvanced] = useState<ServerAdvancedOptions>(DEFAULT_SERVER_ADVANCED);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    loadServerSettingsWithAdvanced().then(({ url, advanced: adv }) => {
      setServerUrl(url);
      setAdvanced(adv);
    });
  }, []);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult("idle");
    setErrorMessage("");

    try {
      const ok = await testServerConnection(serverUrl, advanced);
      setTestResult(ok ? "success" : "error");
      if (!ok) setErrorMessage("Health check failed. Server did not respond with 'ok'.");
    } catch (err) {
      setTestResult("error");
      setErrorMessage(err instanceof Error ? err.message : "Connection test failed");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage("");
    setErrorMessage("");

    try {
      await saveServerConnection(serverUrl, advanced);
      setSaveMessage("Settings saved successfully. Extension will use the new server.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ padding: 32, fontFamily: "system-ui, sans-serif", maxWidth: 520 }}>
      <h1>VaultLock Extension Settings</h1>

      <section style={{ marginTop: 24 }}>
        <h2>Server Connection</h2>

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
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="https://your-vault.example.com"
            style={{ width: "100%", padding: 8, fontSize: 14 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
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

        <div style={{ marginBottom: 16 }}>
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
            Allow insecure HTTP connections (not recommended)
          </label>
        </div>

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
        </div>

        {testResult === "success" && (
          <p style={{ color: "green", marginTop: 8 }}>✅ Connection successful</p>
        )}
        {testResult === "error" && errorMessage && (
          <p style={{ color: "red", marginTop: 8 }}>{errorMessage}</p>
        )}
        {saveMessage && <p style={{ color: "green", marginTop: 8 }}>{saveMessage}</p>}
      </section>

      <p style={{ marginTop: 40, fontSize: 13, color: "#666" }}>
        These settings are stored locally in your browser. Auth and vault data are handled in later
        sub-tasks.
      </p>
    </div>
  );
}
