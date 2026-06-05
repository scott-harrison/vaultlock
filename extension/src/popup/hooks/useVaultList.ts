import type { LoginItemPlaintext, VaultItemResponse } from "@vaultlock/shared/types";
import { useCallback, useEffect, useState } from "react";
import { loginMatchesPageHost } from "../../lib/loginHostMatch";
import type { AutofillRequest } from "../../lib/messaging";
import type { DecryptedVaultItem } from "../../lib/vaultItems";

export function useVaultList(pendingFillRequest: AutofillRequest | null) {
  const [items, setItems] = useState<DecryptedVaultItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fillError, setFillError] = useState<string | null>(null);
  const [fillingId, setFillingId] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadFromCache = useCallback(async (): Promise<{
    encryptedCount: number;
    decryptedCount: number;
  }> => {
    const encryptedCache = await chrome.runtime
      .sendMessage({ type: "GET_ENCRYPTED_VAULT_CACHE" })
      .catch(() => null);

    if (!encryptedCache || !Array.isArray(encryptedCache.items)) {
      setItems([]);
      return { encryptedCount: 0, decryptedCount: 0 };
    }

    const encryptedItems = encryptedCache.items as VaultItemResponse[];
    const { sortVaultItems } = await import("../../lib/vaultItems");
    const { decryptVaultItem } = await import("../../lib/vaultCrypto");
    let decryptFailures = 0;

    const decrypted = await Promise.all(
      encryptedItems.map(async (item) => {
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
          decryptFailures += 1;
          return null;
        }
      }),
    ).then((arr) => arr.filter(Boolean));

    setItems(sortVaultItems(decrypted as DecryptedVaultItem[]));
    setLastSynced(
      typeof encryptedCache.updatedAt === "number" ? encryptedCache.updatedAt : Date.now(),
    );

    if (encryptedItems.length > 0 && decrypted.length === 0) {
      const { isVaultUnlocked } = await import("../../lib/vaultSession");
      if (!isVaultUnlocked()) {
        setError("Vault is locked. Enter your master password to view items.");
      } else if (decryptFailures > 0) {
        setError(
          "Synced items could not be decrypted with this unlock key. " +
            "The extension may have stored a different encryption key than your desktop vault. " +
            "Unlock once in the VaultLock desktop app (this restores the server key), then sign out here, clear extension data, and sign in again.",
        );
      }
    }

    return { encryptedCount: encryptedItems.length, decryptedCount: decrypted.length };
  }, []);

  const refreshFromServer = useCallback(
    async (forceFull = false) => {
      setIsSyncing(true);
      setError(null);
      try {
        const result = await chrome.runtime.sendMessage({
          type: "TRIGGER_VAULT_SYNC",
          forceFull,
        });
        if (result && typeof result === "object" && "success" in result && !result.success) {
          throw new Error(
            "error" in result && typeof result.error === "string"
              ? result.error
              : "Vault sync failed",
          );
        }
        await loadFromCache();
      } catch (err) {
        console.error("Vault sync failed", err);
        setError(err instanceof Error ? err.message : "Failed to sync vault items.");
      } finally {
        setIsSyncing(false);
      }
    },
    [loadFromCache],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const { encryptedCount, decryptedCount } = await loadFromCache();
        if (!cancelled && encryptedCount === 0 && decryptedCount === 0) {
          await refreshFromServer(true);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load vault items", err);
          setError("Failed to load vault items. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadFromCache, refreshFromServer]);

  useEffect(() => {
    const handleMessage = (message: unknown) => {
      const msg = message as { type?: string };
      if (msg.type === "ENCRYPTED_VAULT_CACHE_UPDATED") {
        void loadFromCache();
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [loadFromCache]);

  const filteredItems = items.filter((item) => {
    const term = search.toLowerCase();
    const title = (item.plaintext?.title || "").toLowerCase();
    const username =
      item.itemType === "login"
        ? ((item.plaintext as LoginItemPlaintext).username || "").toLowerCase()
        : "";
    const content =
      item.itemType === "note"
        ? (
            (item.plaintext as import("@vaultlock/shared/types").NoteItemPlaintext).content || ""
          ).toLowerCase()
        : "";
    const matchesSearch = title.includes(term) || username.includes(term) || content.includes(term);
    if (!matchesSearch) return false;

    if (pendingFillRequest && item.itemType === "login") {
      const login = item.plaintext as LoginItemPlaintext;
      return loginMatchesPageHost(login.url, pendingFillRequest.hostname);
    }

    return true;
  });

  const handleFill = useCallback(
    async (login: LoginItemPlaintext, itemId: string, onFillComplete: () => void) => {
      if (!pendingFillRequest) return;
      setFillError(null);
      setFillingId(itemId);

      try {
        const result = await chrome.runtime.sendMessage({
          type: "EXECUTE_FILL",
          hostname: pendingFillRequest.hostname,
          fieldType: pendingFillRequest.fieldType,
          associatedFieldId: pendingFillRequest.associatedFieldId,
          username: login.username ?? "",
          password: login.password ?? "",
        });

        if (!result || typeof result !== "object" || !("success" in result) || !result.success) {
          const err =
            result &&
            typeof result === "object" &&
            "error" in result &&
            typeof result.error === "string"
              ? result.error
              : "Could not fill fields on the page";
          throw new Error(err);
        }

        onFillComplete();
        window.close();
      } catch (err) {
        setFillError(err instanceof Error ? err.message : "Fill failed");
      } finally {
        setFillingId(null);
      }
    },
    [pendingFillRequest],
  );

  const clearItems = useCallback(() => {
    setItems([]);
  }, []);

  return {
    items: filteredItems,
    search,
    setSearch,
    loading,
    error,
    fillError,
    fillingId,
    lastSynced,
    isSyncing,
    refreshFromServer,
    handleFill,
    clearItems,
  };
}
