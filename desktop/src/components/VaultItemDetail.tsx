import type { LoginItemPlaintext, NoteItemPlaintext } from "@vaultlock/shared/types";
import { useId, useState } from "react";
import type { DecryptedVaultItem } from "../lib/vaultItems";
import { vaultItemDisplayTitle } from "../lib/vaultItems";

interface VaultItemDetailProps {
  item: DecryptedVaultItem;
  onClose: () => void;
}

function DetailField({
  label,
  value,
  copyValue,
  onCopied,
}: {
  label: string;
  value: string;
  copyValue?: string;
  onCopied: () => void;
}) {
  const fieldId = useId();

  const handleCopy = () => {
    void navigator.clipboard.writeText(copyValue ?? value).then(onCopied);
  };

  return (
    <div className="vault-detail-field">
      <div className="vault-detail-field-header">
        <label className="field-label" htmlFor={fieldId}>
          {label}
        </label>
        <button type="button" className="link-btn vault-detail-copy" onClick={handleCopy}>
          Copy
        </button>
      </div>
      <p id={fieldId} className="vault-detail-value">
        {value}
      </p>
    </div>
  );
}

function LoginDetail({
  item,
  onCopied,
}: {
  item: DecryptedVaultItem;
  onCopied: () => void;
}) {
  const passwordId = useId();
  const login = item.plaintext as LoginItemPlaintext;
  const [showPassword, setShowPassword] = useState(false);
  const password = login.password ?? "";

  const handleCopyPassword = () => {
    if (password) {
      void navigator.clipboard.writeText(password).then(onCopied);
    }
  };

  return (
    <>
      {login.title?.trim() && (
        <DetailField label="Title" value={login.title.trim()} onCopied={onCopied} />
      )}
      {login.url?.trim() && (
        <div className="vault-detail-field">
          <div className="vault-detail-field-header">
            <span className="field-label">URL</span>
            <button
              type="button"
              className="link-btn vault-detail-copy"
              onClick={() => {
                const url = login.url?.trim();
                if (url) {
                  void navigator.clipboard.writeText(url).then(onCopied);
                }
              }}
            >
              Copy
            </button>
          </div>
          <a
            className="vault-detail-link"
            href={login.url.trim()}
            target="_blank"
            rel="noreferrer noopener"
          >
            {login.url.trim()}
          </a>
        </div>
      )}
      {login.username?.trim() && (
        <DetailField label="Username" value={login.username.trim()} onCopied={onCopied} />
      )}
      {password && (
        <div className="vault-detail-field">
          <div className="vault-detail-field-header">
            <label className="field-label" htmlFor={passwordId}>
              Password
            </label>
            <div className="vault-detail-actions">
              <button
                type="button"
                className="link-btn vault-detail-copy"
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
              <button
                type="button"
                className="link-btn vault-detail-copy"
                onClick={handleCopyPassword}
              >
                Copy
              </button>
            </div>
          </div>
          <p id={passwordId} className="vault-detail-value vault-detail-password">
            {showPassword ? password : "••••••••"}
          </p>
        </div>
      )}
      {login.notes?.trim() && (
        <DetailField label="Notes" value={login.notes.trim()} onCopied={onCopied} />
      )}
    </>
  );
}

function NoteDetail({
  item,
  onCopied,
}: {
  item: DecryptedVaultItem;
  onCopied: () => void;
}) {
  const note = item.plaintext as NoteItemPlaintext;

  return (
    <>
      {note.title?.trim() && (
        <DetailField label="Title" value={note.title.trim()} onCopied={onCopied} />
      )}
      {note.content?.trim() && (
        <DetailField label="Content" value={note.content.trim()} onCopied={onCopied} />
      )}
    </>
  );
}

export function VaultItemDetail({ item, onClose }: VaultItemDetailProps) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const handleCopied = () => {
    setCopyMessage("Copied to clipboard.");
    window.setTimeout(() => setCopyMessage(null), 2000);
  };

  const hasFields =
    item.itemType === "login"
      ? Object.values(item.plaintext as LoginItemPlaintext).some(
          (value) => typeof value === "string" && value.trim().length > 0,
        )
      : Object.values(item.plaintext as NoteItemPlaintext).some(
          (value) => typeof value === "string" && value.trim().length > 0,
        );

  return (
    <section className="vault-detail-panel" aria-labelledby={`vault-detail-${item.id}`}>
      <div className="vault-detail-header">
        <div>
          <span className="vault-item-type">{item.itemType}</span>
          <h2 id={`vault-detail-${item.id}`} className="vault-detail-title">
            {vaultItemDisplayTitle(item)}
          </h2>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>

      {copyMessage && <p className="feedback feedback-success">{copyMessage}</p>}

      <div className="vault-detail-fields">
        {item.itemType === "login" ? (
          <LoginDetail item={item} onCopied={handleCopied} />
        ) : item.itemType === "note" ? (
          <NoteDetail item={item} onCopied={handleCopied} />
        ) : (
          <p className="hint">This item type is not supported yet.</p>
        )}
        {!hasFields && <p className="hint">This item has no saved fields.</p>}
      </div>
    </section>
  );
}
