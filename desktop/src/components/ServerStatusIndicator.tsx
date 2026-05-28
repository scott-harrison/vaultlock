import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useId, useState } from "react";
import { type ServerAdvancedOptions, shouldWarnInsecureHttp } from "../lib/serverSettings";

export type ConnectionStatus = "unknown" | "checking" | "connected" | "failed";

interface ServerStatusIndicatorProps {
  serverUrl: string;
  status: ConnectionStatus;
  advanced: ServerAdvancedOptions;
  isAuthenticated: boolean;
  onRecheck: () => void;
  onChangeServer: (url: string, advanced: ServerAdvancedOptions) => Promise<void>;
  onServerChangeRequiresSignOut: () => Promise<boolean>;
}

export function ServerStatusIndicator({
  serverUrl,
  status,
  advanced,
  isAuthenticated,
  onRecheck,
  onChangeServer,
  onServerChangeRequiresSignOut,
}: ServerStatusIndicatorProps) {
  const formId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [draftUrl, setDraftUrl] = useState(serverUrl);
  const [draftAdvanced, setDraftAdvanced] = useState(advanced);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const statusText =
    status === "checking"
      ? "Checking connection…"
      : status === "connected"
        ? "Connected"
        : status === "failed"
          ? "Unreachable"
          : "Unknown";

  const openModal = () => {
    setDraftUrl(serverUrl);
    setDraftAdvanced(advanced);
    setModalError(null);
    setIsOpen(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setModalError(null);

    if (draftUrl.trim() !== serverUrl && isAuthenticated) {
      const confirmed = await onServerChangeRequiresSignOut();
      if (!confirmed) {
        return;
      }
    }

    setIsSaving(true);
    try {
      await onChangeServer(draftUrl, draftAdvanced);
      setIsOpen(false);
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "Could not update server");
    } finally {
      setIsSaving(false);
    }
  };

  const insecureWarning = draftUrl.trim()
    ? shouldWarnInsecureHttp(
        /^https?:\/\//i.test(draftUrl.trim()) ? draftUrl.trim() : `https://${draftUrl.trim()}`,
        draftAdvanced,
      )
    : false;

  return (
    <>
      <button
        type="button"
        className="server-indicator"
        aria-label={`Server status: ${statusText}. Click for details.`}
        onClick={openModal}
      >
        <span className={`server-dot server-dot-${status}`} aria-hidden />
        <span className="server-indicator-text">{statusText}</span>
      </button>

      <Dialog open={isOpen} onOpenChange={(next) => !isSaving && setIsOpen(next)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle id={`${formId}-title`}>Server connection</DialogTitle>
          </DialogHeader>

          <p className="hint">
            Status: <strong>{statusText}</strong>
          </p>
          <p className="hint">
            Current URL: <code>{serverUrl}</code>
          </p>

          <form className="screen-form" onSubmit={handleSave}>
            <label className="field-label" htmlFor={`${formId}-url`}>
              Server URL
            </label>
            <input
              id={`${formId}-url`}
              className="text-input"
              type="text"
              value={draftUrl}
              disabled={isSaving}
              onChange={(event) => setDraftUrl(event.currentTarget.value)}
            />

            {insecureWarning && (
              <p className="feedback feedback-warning">
                This server uses HTTP. Prefer HTTPS for production.
              </p>
            )}

            <label className="field-label" htmlFor={`${formId}-timeout`}>
              Request timeout (seconds)
            </label>
            <input
              id={`${formId}-timeout`}
              className="text-input"
              type="number"
              min={3}
              max={120}
              value={Math.round(draftAdvanced.requestTimeoutMs / 1000)}
              disabled={isSaving}
              onChange={(event) =>
                setDraftAdvanced((current) => ({
                  ...current,
                  requestTimeoutMs: Number(event.currentTarget.value) * 1000,
                }))
              }
            />

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={draftAdvanced.allowInsecureHttp}
                disabled={isSaving}
                onChange={(event) =>
                  setDraftAdvanced((current) => ({
                    ...current,
                    allowInsecureHttp: event.currentTarget.checked,
                  }))
                }
              />
              Allow non-localhost HTTP connections
            </label>

            {isAuthenticated && draftUrl.trim() !== serverUrl && (
              <p className="feedback feedback-warning">
                Changing the server URL will sign you out on this device.
              </p>
            )}

            {modalError && <p className="feedback feedback-error">{modalError}</p>}

            <div className="button-row">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isSaving}
                onClick={() => onRecheck()}
              >
                Recheck
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? "Saving…" : "Save & connect"}
              </button>
            </div>
          </form>

          <button type="button" className="link-btn modal-close" onClick={() => setIsOpen(false)}>
            Close
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
