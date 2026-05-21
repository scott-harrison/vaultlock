import { VaultItemDetail } from "@/components/VaultItemDetail";
import { type VaultSection, VaultSidebar } from "@/components/layout/VaultSidebar";
import { VaultCreateDialog } from "@/components/vault/VaultCreateDialog";
import { VaultItemList } from "@/components/vault/VaultItemList";
import { useMountEffect } from "@/hooks/useMountEffect";
import {
  type DecryptedVaultItem,
  createVaultItem,
  listDecryptedVaultItems,
  vaultItemDisplaySubtitle,
  vaultItemDisplayTitle,
} from "@/lib/vaultItems";
import { VaultlockApiError } from "@vaultlock/shared/api";
import type { LoginItemPlaintext, NoteItemPlaintext, VaultItemType } from "@vaultlock/shared/types";
import { useMemo, useRef, useState } from "react";

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

const SECTION_LABELS: Record<VaultSection, string> = {
  logins: "Logins",
  notes: "Notes",
  cards: "Credit cards",
  favourites: "Favourites",
};

const SECTION_ITEM_TYPE: Partial<Record<VaultSection, VaultItemType>> = {
  logins: "login",
  notes: "note",
};

function emptyLoginDraft(): LoginItemPlaintext {
  return { title: "", url: "", username: "", password: "", notes: "" };
}

function emptyNoteDraft(): NoteItemPlaintext {
  return { title: "", content: "" };
}

export function VaultScreen({
  accessToken,
  email,
  onCreateFormOpenChange,
  onLock,
  onSessionExpired,
  onSignOut,
}: VaultScreenProps) {
  const isMountedRef = useRef(true);
  const accessTokenRef = useRef(accessToken);
  const onSessionExpiredRef = useRef(onSessionExpired);

  const [items, setItems] = useState<DecryptedVaultItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<VaultSection>("logins");
  const [searchQuery, setSearchQuery] = useState("");
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

  const filteredItems = useMemo(() => {
    const itemType = SECTION_ITEM_TYPE[activeSection];
    let result = itemType ? items.filter((item) => item.itemType === itemType) : items;
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((item) => {
        const title = vaultItemDisplayTitle(item).toLowerCase();
        const subtitle = vaultItemDisplaySubtitle(item)?.toLowerCase() ?? "";
        return title.includes(query) || subtitle.includes(query);
      });
    }
    return result;
  }, [activeSection, items, searchQuery]);

  const selectedItem =
    filteredItems.find((item) => item.id === selectedItemId) ??
    items.find((item) => item.id === selectedItemId) ??
    null;

  const resetCreateForm = () => {
    setCreateType(activeSection === "notes" ? "note" : "login");
    setLoginDraft(emptyLoginDraft());
    setNoteDraft(emptyNoteDraft());
  };

  const openCreateForm = () => {
    setError(null);
    setSuccess(null);
    resetCreateForm();
    setCreateOpen(true);
  };

  const handleSectionChange = (section: VaultSection) => {
    setActiveSection(section);
    setSearchQuery("");
    setSelectedItemId(null);
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
      setActiveSection(created.itemType === "note" ? "notes" : "logins");
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

  return (
    <div className="flex h-[calc(100svh-2.75rem)] w-full overflow-hidden">
      <VaultSidebar
        activeSection={activeSection}
        email={email}
        onSectionChange={handleSectionChange}
        onNewItem={openCreateForm}
        onLock={onLock}
        onSignOut={onSignOut}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {(error || success) && (
          <div className="border-b border-border px-4 py-2 text-sm">
            {error && <p className="text-destructive">{error}</p>}
            {success && <p className="text-primary">{success}</p>}
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <VaultItemList
            items={filteredItems}
            selectedItemId={selectedItem?.id ?? selectedItemId}
            searchQuery={searchQuery}
            isLoading={isLoading}
            sectionLabel={SECTION_LABELS[activeSection]}
            onSearchChange={setSearchQuery}
            onSelectItem={setSelectedItemId}
            onRefresh={() => void loadItems()}
          />
          <VaultItemDetail item={selectedItem} />
        </div>
      </div>

      <VaultCreateDialog
        open={isCreateOpen}
        isSubmitting={isSubmitting}
        draft={{ createType, loginDraft, noteDraft }}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        onCreateTypeChange={setCreateType}
        onLoginFieldChange={updateLoginField}
        onNoteFieldChange={updateNoteField}
      />
    </div>
  );
}
