import { Button } from "@vaultlock/ui/components/ui/button";
import { Input } from "@vaultlock/ui/components/ui/input";
import { Separator } from "@vaultlock/ui/components/ui/separator";
import { useId, useState } from "react";
import type { ServerAdvancedOptions } from "../../lib/serverSettings";
import type { LastConnectionStatus } from "../../lib/storage";
import { AuthFeedback } from "../../popup/components/AuthFeedback";
import { AuthField } from "../../popup/components/AuthField";
import { authInputClassName, authPrimaryButtonClassName } from "../../popup/constants";
import type { TestResult } from "../hooks/useServerOptions";
import { ConnectionStatusPanel } from "./ConnectionStatusPanel";

interface ServerConnectionSectionProps {
  serverUrl: string;
  advanced: ServerAdvancedOptions;
  normalizedUrl: string;
  isTesting: boolean;
  isSaving: boolean;
  isBusy: boolean;
  currentTestResult: TestResult;
  currentError: string;
  saveMessage: string;
  lastStatus: LastConnectionStatus | null;
  onServerUrlChange: (value: string) => void;
  onAdvancedChange: (value: ServerAdvancedOptions) => void;
  onTest: () => void;
  onSave: () => void;
  onReset: () => void;
}

function shouldWarnInsecureHttp(baseUrl: string, advanced: ServerAdvancedOptions): boolean {
  if (advanced.allowInsecureHttp) {
    return false;
  }
  try {
    const { protocol, hostname } = new URL(baseUrl);
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    return protocol === "http:" && !isLocalhost;
  } catch {
    return false;
  }
}

export function ServerConnectionSection({
  serverUrl,
  advanced,
  normalizedUrl,
  isTesting,
  isSaving,
  isBusy,
  currentTestResult,
  currentError,
  saveMessage,
  lastStatus,
  onServerUrlChange,
  onAdvancedChange,
  onTest,
  onSave,
  onReset,
}: ServerConnectionSectionProps) {
  const formId = useId();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const draftUrl = serverUrl.trim()
    ? /^https?:\/\//i.test(serverUrl.trim())
      ? serverUrl.trim()
      : `https://${serverUrl.trim()}`
    : "";

  const insecureWarning = draftUrl ? shouldWarnInsecureHttp(draftUrl, advanced) : false;
  const hasUrl = Boolean(serverUrl.trim());

  return (
    <section className="space-y-6 rounded-xl border border-border bg-card/40 p-6">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Server connection</h2>
        <p className="text-sm text-muted-foreground">
          Point the extension at your self-hosted Vaultlock instance.
        </p>
      </div>

      <ConnectionStatusPanel
        normalizedUrl={normalizedUrl}
        currentTestResult={currentTestResult}
        lastStatus={lastStatus}
      />

      <div className="space-y-4">
        <AuthField label="Server URL" htmlFor={`${formId}-url`}>
          <Input
            id={`${formId}-url`}
            className={authInputClassName}
            type="text"
            inputMode="url"
            autoComplete="off"
            placeholder="https://vault.example.com"
            value={serverUrl}
            disabled={isBusy}
            onChange={(event) => onServerUrlChange(event.target.value)}
          />
        </AuthField>

        {insecureWarning ? (
          <AuthFeedback variant="warning">
            This server uses HTTP. Prefer HTTPS for production, or enable the advanced option below.
          </AuthFeedback>
        ) : null}

        <button
          type="button"
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          onClick={() => setShowAdvanced((value) => !value)}
        >
          {showAdvanced ? "Hide advanced options" : "Advanced options"}
        </button>

        {showAdvanced ? (
          <div className="space-y-4 rounded-xl border border-border/80 bg-muted/20 p-4">
            <AuthField label="Request timeout (seconds)" htmlFor={`${formId}-timeout`}>
              <Input
                id={`${formId}-timeout`}
                className={authInputClassName}
                type="number"
                min={3}
                max={120}
                value={Math.round(advanced.requestTimeoutMs / 1000)}
                disabled={isBusy}
                onChange={(event) =>
                  onAdvancedChange({
                    ...advanced,
                    requestTimeoutMs: Number(event.target.value) * 1000,
                  })
                }
              />
            </AuthField>

            <label className="flex items-start gap-3 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border-border accent-primary"
                checked={advanced.allowInsecureHttp}
                disabled={isBusy}
                onChange={(event) =>
                  onAdvancedChange({
                    ...advanced,
                    allowInsecureHttp: event.target.checked,
                  })
                }
              />
              Allow non-localhost HTTP connections
            </label>
          </div>
        ) : null}
      </div>

      <Separator />

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-full border-border/80 px-6"
          disabled={isBusy || !hasUrl}
          onClick={onTest}
        >
          {isTesting ? "Testing…" : "Test connection"}
        </Button>
        <Button
          type="button"
          className={`${authPrimaryButtonClassName} w-auto px-6`}
          disabled={isBusy || !hasUrl}
          onClick={onSave}
        >
          {isSaving ? "Saving…" : "Save settings"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11 rounded-full px-6 text-muted-foreground hover:text-foreground"
          disabled={isBusy}
          onClick={onReset}
        >
          Reset to defaults
        </Button>
      </div>

      {currentTestResult === "success" ? (
        <AuthFeedback variant="success">Connection successful.</AuthFeedback>
      ) : null}
      {currentTestResult === "error" && currentError ? (
        <AuthFeedback variant="error">{currentError}</AuthFeedback>
      ) : null}
      {saveMessage ? <AuthFeedback variant="success">{saveMessage}</AuthFeedback> : null}
      {currentTestResult === "idle" && currentError && !saveMessage ? (
        <AuthFeedback variant="error">{currentError}</AuthFeedback>
      ) : null}
    </section>
  );
}
