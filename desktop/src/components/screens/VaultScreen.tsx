import { VaultlockApiError } from "@vaultlock/shared/api";
import type { LoginItemPlaintext, NoteItemPlaintext, VaultItemType } from "@vaultlock/shared/types";
import { useId, useRef, useState } from "react";
import { useMountEffect } from "../../hooks/useMountEffect";
import {
  type DecryptedVaultItem,
  createVaultItem,
  listDecryptedVaultItems,
  vaultItemDisplaySubtitle,
  vaultItemDisplayTitle,
} from "../../lib/vaultItems";
import { VaultItemDetail } from "../VaultItemDetail";

interface VaultScreenProps {
  accessToken: string;
  email: string;
  onCreateFormOpenChange?: (isOpen: boolean) => void;
  onLock: () => void;
  onSessionExpired: () => void;
  onSignOut: () => void;
}

const GENERIC_VAULT_ERROR = "Couldn't load vault items. Try again.";
const GENERIC_CREATE_ERROR = "Couldn't save this item. Try again.";

function emptyLoginDraft(): LoginItemPlaintext {
  return {
    title: "",
    url: "",
    username: "",
    password: "",
    notes: "",
  };
}

function emptyNoteDraft(): NoteItemPlaintext {
  return {
    title: "",
    content: "",
  };
}

export function VaultScreen({
  accessToken,
  email,
  onCreateFormOpenChange,
  onLock,
  onSessionExpired,
  onSignOut,
}: VaultScreenProps) {
  const formId = useId();
  const isMountedRef = useRef(true);
  const accessTokenRef = useRef(accessToken);
  const onSessionExpiredRef = useRef(onSessionExpired);
  const [items, setItems] = useState<DecryptedVaultItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<VaultItemType>("login");
  const [loginDraft, setLoginDraft] = useState(emptyLoginDraft);
  const [noteDraft, setNoteDraft] = useState(emptyNoteDraft);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  accessTokenRef.current = accessToken;
  onSessionExpiredRef.current = onSessionExpired;

  const setCreateOpen = (next: boolean) => {
    setIsCreateOpen(next);
    onCreateFormOpenChange?.(next);
  };

  const notifySessionExpired = () => {
    queueMicrotask(() => {
      if (isMountedRef.current) {
        onSessionExpiredRef.current();
      }
    });
  };

  const updateLoginField = (
    field: keyof LoginItemPlaintext,
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const value = event.target.value;
    setLoginDraft((current) => ({ ...current, [field]: value }));
  };

  const updateNoteField = (
    field: keyof NoteItemPlaintext,
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const value = event.target.value;
    setNoteDraft((current) => ({ ...current, [field]: value }));
  };

  const loadItems = async () => {
    if (!accessTokenRef.current) {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      notifySessionExpired();
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const nextItems = await listDecryptedVaultItems(accessTokenRef.current);
      if (!isMountedRef.current) {
        return;
      }
      setItems(nextItems);
      setSelectedItemId((current) =>
        current && nextItems.some((item) => item.id === current) ? current : null,
      );
    } catch (loadError) {
      if (!isMountedRef.current) {
        return;
      }
      if (loadError instanceof VaultlockApiError && loadError.status === 401) {
        notifySessionExpired();
        return;
      }
      setError(GENERIC_VAULT_ERROR);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  useMountEffect(() => {
    isMountedRef.current = true;
    void loadItems();
    return () => {
      isMountedRef.current = false;
      onCreateFormOpenChange?.(false);
    };
  });

  const resetCreateForm = () => {
    setCreateType("login");
    setLoginDraft(emptyLoginDraft());
    setNoteDraft(emptyNoteDraft());
  };

  const openCreateForm = () => {
    setError(null);
    setSuccess(null);
    setSelectedItemId(null);
    resetCreateForm();
    setCreateOpen(true);
  };

  const closeCreateForm = () => {
    if (isSubmitting) {
      return;
    }
    setCreateOpen(false);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const created =
        createType === "login"
          ? await createVaultItem(accessTokenRef.current, "login", {
              title: loginDraft.title?.trim() || undefined,
              url: loginDraft.url?.trim() || undefined,
              username: loginDraft.username?.trim() || undefined,
              password: loginDraft.password || undefined,
              notes: loginDraft.notes?.trim() || undefined,
            })
          : await createVaultItem(accessTokenRef.current, "note", {
              title: noteDraft.title?.trim() || undefined,
              content: noteDraft.content?.trim() || undefined,
            });

      if (!isMountedRef.current) {
        return;
      }

      setItems((current) =>
        [...current, created].sort((left, right) =>
          vaultItemDisplayTitle(left).localeCompare(vaultItemDisplayTitle(right)),
        ),
      );
      setSelectedItemId(created.id);
      setCreateOpen(false);
      resetCreateForm();
      setSuccess("Item saved.");
    } catch (createError) {
      if (!isMountedRef.current) {
        return;
      }
      if (createError instanceof VaultlockApiError && createError.status === 401) {
        notifySessionExpired();
        return;
      }
      setError(GENERIC_CREATE_ERROR);
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;

  return (
    <section className="screen vault-screen">
      <div className="screen-header">
        <h1>Vault</h1>
        <p className="hint">
          Unlocked as <strong>{email}</strong>
        </p>
      </div>

      <div className="vault-toolbar">
        <button
          type="button"
          className="btn btn-primary"
          onClick={isCreateOpen ? closeCreateForm : openCreateForm}
        >
          {isCreateOpen ? "Cancel add" : "Add item"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => void loadItems()}>
          Refresh
        </button>
      </div>

      {error && <p className="feedback feedback-error">{error}</p>}
      {success && <p className="feedback feedback-success">{success}</p>}

      {isCreateOpen && (
        <section className="vault-create-panel" aria-labelledby={`${formId}-create-title`}>
          <h2 id={`${formId}-create-title`} className="vault-create-title">
            Add vault item
          </h2>

          <form className="screen-form" onSubmit={handleCreate}>
            <label className="field-label" htmlFor={`${formId}-type`}>
              Item type
            </label>
            <select
              id={`${formId}-type`}
              className="text-input"
              value={createType}
              disabled={isSubmitting}
              onChange={(event) => setCreateType(event.target.value as VaultItemType)}
            >
              <option value="login">Login</option>
              <option value="note">Secure note</option>
            </select>

            {createType === "login" ? (
              <>
                <label className="field-label" htmlFor={`${formId}-title`}>
                  Title
                </label>
                <input
                  id={`${formId}-title`}
                  className="text-input"
                  type="text"
                  placeholder="e.g. GitHub"
                  value={loginDraft.title ?? ""}
                  disabled={isSubmitting}
                  onChange={(event) => updateLoginField("title", event)}
                />

                <label className="field-label" htmlFor={`${formId}-url`}>
                  URL
                </label>
                <input
                  id={`${formId}-url`}
                  className="text-input"
                  type="text"
                  inputMode="url"
                  placeholder="https://"
                  value={loginDraft.url ?? ""}
                  disabled={isSubmitting}
                  onChange={(event) => updateLoginField("url", event)}
                />

                <label className="field-label" htmlFor={`${formId}-username`}>
                  Username
                </label>
                <input
                  id={`${formId}-username`}
                  className="text-input"
                  type="text"
                  autoComplete="username"
                  value={loginDraft.username ?? ""}
                  disabled={isSubmitting}
                  onChange={(event) => updateLoginField("username", event)}
                />

                <label className="field-label" htmlFor={`${formId}-password`}>
                  Password
                </label>
                <input
                  id={`${formId}-password`}
                  className="text-input"
                  type="password"
                  autoComplete="new-password"
                  value={loginDraft.password ?? ""}
                  disabled={isSubmitting}
                  onChange={(event) => updateLoginField("password", event)}
                />

                <label className="field-label" htmlFor={`${formId}-notes`}>
                  Notes
                </label>
                <textarea
                  id={`${formId}-notes`}
                  className="text-input text-area"
                  rows={3}
                  value={loginDraft.notes ?? ""}
                  disabled={isSubmitting}
                  onChange={(event) => updateLoginField("notes", event)}
                />
              </>
            ) : (
              <>
                <label className="field-label" htmlFor={`${formId}-note-title`}>
                  Title
                </label>
                <input
                  id={`${formId}-note-title`}
                  className="text-input"
                  type="text"
                  placeholder="e.g. Wi-Fi password"
                  value={noteDraft.title ?? ""}
                  disabled={isSubmitting}
                  onChange={(event) => updateNoteField("title", event)}
                />

                <label className="field-label" htmlFor={`${formId}-content`}>
                  Content
                </label>
                <textarea
                  id={`${formId}-content`}
                  className="text-input text-area"
                  rows={5}
                  value={noteDraft.content ?? ""}
                  disabled={isSubmitting}
                  onChange={(event) => updateNoteField("content", event)}
                />
              </>
            )}

            <div className="button-row">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isSubmitting}
                onClick={closeCreateForm}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save item"}
              </button>
            </div>
          </form>
        </section>
      )}

      {isLoading ? (
        <p className="hint">Loading items…</p>
      ) : items.length === 0 ? (
        <p className="hint">No items yet. Add a login or secure note to get started.</p>
      ) : (
        <ul className="vault-list">
          {items.map((item) => {
            const subtitle = vaultItemDisplaySubtitle(item);
            const isSelected = item.id === selectedItemId;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`vault-item${isSelected ? " vault-item-selected" : ""}`}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedItemId(item.id)}
                >
                  <div className="vault-item-main">
                    <span className="vault-item-type">{item.itemType}</span>
                    <strong className="vault-item-title">{vaultItemDisplayTitle(item)}</strong>
                    {subtitle && <span className="vault-item-subtitle">{subtitle}</span>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selectedItem && (
        <VaultItemDetail item={selectedItem} onClose={() => setSelectedItemId(null)} />
      )}

      <div className="button-row">
        <button type="button" className="btn btn-secondary" onClick={onLock}>
          Lock vault
        </button>
        <button type="button" className="btn btn-secondary" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </section>
  );
}
