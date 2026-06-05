import { AuthFeedback } from "@/components/auth/AuthFeedback";
import { AuthField } from "@/components/auth/AuthField";
import { Button } from "@vaultlock/ui/components/ui/button";
import { Input } from "@vaultlock/ui/components/ui/input";
import {
  DEFAULT_SERVER_ADVANCED,
  type ServerAdvancedOptions,
  shouldWarnInsecureHttp,
} from "@/lib/serverSettings";
import { useId, useState } from "react";

interface ConnectServerScreenProps {
  initialUrl?: string;
  initialAdvanced?: ServerAdvancedOptions;
  isSubmitting: boolean;
  error: string | null;
  onConnect: (url: string, advanced: ServerAdvancedOptions) => void;
}

const authInputClassName =
  "h-11 rounded-lg border-border/80 bg-muted/30 shadow-none focus-visible:ring-primary/40";
const authPrimaryButtonClassName =
  "h-11 w-full rounded-full bg-foreground text-background shadow-sm hover:bg-foreground/90";

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
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Connect to your server</h1>
        <p className="text-sm text-muted-foreground">
          Enter your Vaultlock server address — for example{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
            https://vault.example.com
          </code>{" "}
          (no trailing slash).
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <AuthField label="Server URL" htmlFor={`${formId}-url`}>
          <Input
            id={`${formId}-url`}
            className={authInputClassName}
            type="text"
            inputMode="url"
            autoComplete="off"
            placeholder="https://vault.example.com"
            value={url}
            disabled={isSubmitting}
            onChange={(event) => setUrl(event.target.value)}
          />
        </AuthField>

        {insecureWarning && (
          <AuthFeedback variant="warning">
            This server uses HTTP. Prefer HTTPS for production, or enable the advanced option below.
          </AuthFeedback>
        )}

        <button
          type="button"
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          onClick={() => setShowAdvanced((value) => !value)}
        >
          {showAdvanced ? "Hide advanced options" : "Advanced options"}
        </button>

        {showAdvanced && (
          <div className="space-y-4 rounded-xl border border-border/80 bg-muted/20 p-4">
            <AuthField label="Request timeout (seconds)" htmlFor={`${formId}-timeout`}>
              <Input
                id={`${formId}-timeout`}
                className={authInputClassName}
                type="number"
                min={3}
                max={120}
                value={Math.round(advanced.requestTimeoutMs / 1000)}
                disabled={isSubmitting}
                onChange={(event) =>
                  setAdvanced((current) => ({
                    ...current,
                    requestTimeoutMs: Number(event.target.value) * 1000,
                  }))
                }
              />
            </AuthField>

            <label className="flex items-start gap-3 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border-border accent-primary"
                checked={advanced.allowInsecureHttp}
                disabled={isSubmitting}
                onChange={(event) =>
                  setAdvanced((current) => ({
                    ...current,
                    allowInsecureHttp: event.target.checked,
                  }))
                }
              />
              Allow non-localhost HTTP connections
            </label>

            <label className="flex items-start gap-3 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border-border accent-primary"
                checked={advanced.trustSelfSignedCert}
                disabled={isSubmitting}
                onChange={(event) =>
                  setAdvanced((current) => ({
                    ...current,
                    trustSelfSignedCert: event.target.checked,
                  }))
                }
              />
              Trust self-signed certificates (coming soon)
            </label>
          </div>
        )}

        {error && <AuthFeedback variant="error">{error}</AuthFeedback>}

        <Button type="submit" className={authPrimaryButtonClassName} disabled={isSubmitting}>
          {isSubmitting ? "Connecting…" : "Connect"}
        </Button>
      </form>
    </div>
  );
}
