import { useState } from "react";
import { useMountEffect } from "../hooks/useMountEffect";
import {
  loadServerBaseUrl,
  normalizeServerBaseUrl,
  saveServerBaseUrl,
  testServerConnection,
} from "../lib/serverSettings";

type ConnectionStatus = "idle" | "testing" | "connected" | "failed";

export function ServerSettings() {
  const [baseUrl, setBaseUrl] = useState("");
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useMountEffect(() => {
    let cancelled = false;

    loadServerBaseUrl()
      .then((url) => {
        if (cancelled) {
          return;
        }
        setBaseUrl(url);
        setSavedUrl(url);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setMessage(error instanceof Error ? error.message : "Failed to load settings");
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  });

  const handleSave = async () => {
    setMessage(null);
    try {
      const normalized = await saveServerBaseUrl(baseUrl);
      setBaseUrl(normalized);
      setSavedUrl(normalized);
      setMessage("Server URL saved.");
      setConnectionStatus("idle");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save server URL");
    }
  };

  const handleTest = async () => {
    setMessage(null);
    setConnectionStatus("testing");

    try {
      const normalized = normalizeServerBaseUrl(baseUrl);
      const ok = await testServerConnection(normalized);

      if (ok) {
        setConnectionStatus("connected");
        setMessage(`Connected to ${normalized}`);
        return;
      }

      setConnectionStatus("failed");
      setMessage(`Server at ${normalized} did not respond with a healthy status.`);
    } catch (error) {
      setConnectionStatus("failed");
      setMessage(error instanceof Error ? error.message : "Connection test failed");
    }
  };

  const statusLabel =
    connectionStatus === "testing"
      ? "Testing…"
      : connectionStatus === "connected"
        ? "Connected"
        : connectionStatus === "failed"
          ? "Unreachable"
          : null;

  return (
    <section className="card settings-card">
      <h2>Server connection</h2>
      <p className="hint">
        Point the desktop app at your Vaultlock backend (self-hosted or local dev).
      </p>

      <label className="field-label" htmlFor="server-url">
        Server URL
      </label>
      <input
        id="server-url"
        className="text-input"
        type="url"
        placeholder="http://localhost:8080"
        value={baseUrl}
        disabled={isLoading}
        onChange={(event) => setBaseUrl(event.currentTarget.value)}
      />

      {savedUrl && !isLoading && (
        <p className="saved-url">
          Saved: <code>{savedUrl}</code>
        </p>
      )}

      <div className="button-row">
        <button type="button" className="btn btn-primary" disabled={isLoading} onClick={handleSave}>
          Save
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={isLoading || connectionStatus === "testing"}
          onClick={handleTest}
        >
          Test connection
        </button>
      </div>

      {statusLabel && (
        <output className={`status status-${connectionStatus}`}>{statusLabel}</output>
      )}

      {message && (
        <p
          className={`feedback ${connectionStatus === "failed" ? "feedback-error" : "feedback-info"}`}
        >
          {message}
        </p>
      )}
    </section>
  );
}
