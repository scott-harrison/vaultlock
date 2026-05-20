import { useId, useState } from "react";
import {
  DEFAULT_SERVER_ADVANCED,
  type ServerAdvancedOptions,
  shouldWarnInsecureHttp,
} from "../../lib/serverSettings";

interface ConnectServerScreenProps {
  initialUrl?: string;
  initialAdvanced?: ServerAdvancedOptions;
  isSubmitting: boolean;
  error: string | null;
  onConnect: (url: string, advanced: ServerAdvancedOptions) => void;
}

export function ConnectServerScreen({
  initialUrl = "",
  initialAdvanced = DEFAULT_SERVER_ADVANCED,
  isSubmitting,
  error,
  onConnect,
}: ConnectServerScreenProps) {
  const formId = useId();
  const [url, setUrl] = useState(initialUrl);
  const [advanced, setAdvanced] = useState(initialAdvanced);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const insecureWarning = url.trim()
    ? shouldWarnInsecureHttp(
        /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`,
        advanced,
      )
    : false;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onConnect(url, advanced);
  };

  return (
    <section className="screen">
      <div className="screen-header">
        <h1>Connect to your server</h1>
        <p className="hint">
          Enter your Vaultlock server address — for example <code>https://vault.example.com</code>{" "}
          (no trailing slash).
        </p>
      </div>

      <form className="screen-form" onSubmit={handleSubmit}>
        <label className="field-label" htmlFor={`${formId}-url`}>
          Server URL
        </label>
        <input
          id={`${formId}-url`}
          className="text-input"
          type="text"
          inputMode="url"
          autoComplete="off"
          placeholder="https://vault.example.com"
          value={url}
          disabled={isSubmitting}
          onChange={(event) => setUrl(event.currentTarget.value)}
        />

        {insecureWarning && (
          <p className="feedback feedback-warning">
            This server uses HTTP. Prefer HTTPS for production, or enable advanced option below.
          </p>
        )}

        <button
          type="button"
          className="link-btn"
          onClick={() => setShowAdvanced((value) => !value)}
        >
          {showAdvanced ? "Hide advanced" : "Advanced options"}
        </button>

        {showAdvanced && (
          <div className="advanced-panel">
            <label className="field-label" htmlFor={`${formId}-timeout`}>
              Request timeout (seconds)
            </label>
            <input
              id={`${formId}-timeout`}
              className="text-input"
              type="number"
              min={3}
              max={120}
              value={Math.round(advanced.requestTimeoutMs / 1000)}
              disabled={isSubmitting}
              onChange={(event) =>
                setAdvanced((current) => ({
                  ...current,
                  requestTimeoutMs: Number(event.currentTarget.value) * 1000,
                }))
              }
            />

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={advanced.allowInsecureHttp}
                disabled={isSubmitting}
                onChange={(event) =>
                  setAdvanced((current) => ({
                    ...current,
                    allowInsecureHttp: event.currentTarget.checked,
                  }))
                }
              />
              Allow non-localhost HTTP connections
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={advanced.trustSelfSignedCert}
                disabled={isSubmitting}
                onChange={(event) =>
                  setAdvanced((current) => ({
                    ...current,
                    trustSelfSignedCert: event.currentTarget.checked,
                  }))
                }
              />
              Trust self-signed certificates (coming soon)
            </label>
          </div>
        )}

        {error && <p className="feedback feedback-error">{error}</p>}

        <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
          {isSubmitting ? "Connecting…" : "Connect"}
        </button>
      </form>
    </section>
  );
}
