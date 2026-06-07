import type { LoginItemPlaintext } from "@vaultlock/shared/types";
import { Button } from "@vaultlock/ui/components/ui/button";
import { Input } from "@vaultlock/ui/components/ui/input";
import { useEffect, useId, useState } from "react";
import type { SaveLoginCandidate } from "../../lib/messaging";
import type { DecryptedVaultItem } from "../../lib/vaultItems";
import {
  createLoginVaultItem,
  findMatchingLoginItem,
  updateLoginVaultItem,
} from "../../lib/vaultSave";
import { authInputClassName, authPrimaryButtonClassName } from "../constants";
import { AuthFeedback } from "./AuthFeedback";
import { AuthField } from "./AuthField";
import { PopupHeader } from "./PopupHeader";
import { PopupShell } from "./PopupShell";

interface SaveLoginFormProps {
  serverUrl: string;
  candidate: SaveLoginCandidate;
  onCancel: () => void;
  onSaved: () => void;
}

async function loadExistingItems(): Promise<DecryptedVaultItem[]> {
  const encryptedCache = await chrome.runtime
    .sendMessage({ type: "GET_ENCRYPTED_VAULT_CACHE" })
    .catch(() => null);

  if (!encryptedCache || !Array.isArray(encryptedCache.items)) {
    return [];
  }

  const { decryptVaultItem } = await import("../../lib/vaultCrypto");
  const decrypted = await Promise.all(
    encryptedCache.items.map(async (item: import("@vaultlock/shared/types").VaultItemResponse) => {
      try {
        const plaintext = await decryptVaultItem(item);
        return {
          id: item.id,
          itemType: item.item_type,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
          plaintext,
        };
      } catch {
        return null;
      }
    }),
  );

  return decrypted.filter(Boolean) as DecryptedVaultItem[];
}

export function SaveLoginForm({ serverUrl, candidate, onCancel, onSaved }: SaveLoginFormProps) {
  const formId = useId();
  const [title, setTitle] = useState(candidate.title);
  const [url, setUrl] = useState(candidate.pageUrl);
  const [username, setUsername] = useState(candidate.username);
  const [password, setPassword] = useState(candidate.password);
  const [existingItemId, setExistingItemId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const items = await loadExistingItems();
      if (cancelled) {
        return;
      }

      const existing = findMatchingLoginItem(candidate.username, candidate.pageUrl, items);
      if (existing) {
        const login = existing.plaintext as LoginItemPlaintext;
        setExistingItemId(existing.id);
        setTitle(login.title || candidate.title);
        setUrl(login.url || candidate.pageUrl);
        setUsername(login.username || candidate.username);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [candidate.pageUrl, candidate.title, candidate.username]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    const plaintext: LoginItemPlaintext = {
      title: title.trim() || candidate.hostname,
      url: url.trim() || candidate.pageUrl,
      username: username.trim(),
      password,
    };

    try {
      if (existingItemId) {
        await updateLoginVaultItem(existingItemId, plaintext);
      } else {
        await createLoginVaultItem(plaintext);
      }

      await chrome.runtime.sendMessage({ type: "CLEAR_PENDING_SAVE_LOGIN" }).catch(() => {});
      onSaved();
      window.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save login");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PopupShell>
      <PopupHeader serverUrl={serverUrl} />
      <section className="space-y-4 rounded-lg border border-border bg-card/40 p-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">
            {existingItemId ? "Update saved login" : "Save new login"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {existingItemId
              ? "A matching login already exists for this site. Review before updating."
              : "Review the captured credentials before saving to your vault."}
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <AuthField label="Title" htmlFor={`${formId}-title`}>
            <Input
              id={`${formId}-title`}
              className={authInputClassName}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </AuthField>

          <AuthField label="URL" htmlFor={`${formId}-url`}>
            <Input
              id={`${formId}-url`}
              className={authInputClassName}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              required
            />
          </AuthField>

          <AuthField label="Username" htmlFor={`${formId}-username`}>
            <Input
              id={`${formId}-username`}
              className={authInputClassName}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
            />
          </AuthField>

          <AuthField label="Password" htmlFor={`${formId}-password`}>
            <Input
              id={`${formId}-password`}
              type="password"
              className={authInputClassName}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="new-password"
            />
          </AuthField>

          {error ? <AuthFeedback variant="error">{error}</AuthFeedback> : null}

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-11 flex-1" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="submit"
              className={`${authPrimaryButtonClassName} flex-1`}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving…" : existingItemId ? "Update login" : "Save login"}
            </Button>
          </div>
        </form>
      </section>
    </PopupShell>
  );
}
