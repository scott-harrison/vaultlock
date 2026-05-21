import { VaultItemDetail } from "@/components/VaultItemDetail";
import { type VaultSection, VaultSidebar } from "@/components/layout/VaultSidebar";
import { PasswordGeneratorDialog } from "@/components/vault/PasswordGeneratorDialog";
import { VaultCreateDialog } from "@/components/vault/VaultCreateDialog";
import type { VaultCreateDraft } from "@/components/vault/VaultCreateDialog";
import { VaultDeleteDialog } from "@/components/vault/VaultDeleteDialog";
import { VaultItemList } from "@/components/vault/VaultItemList";
import { useMountEffect } from "@/hooks/useMountEffect";
import {
  type DecryptedVaultItem,
  createVaultItem,
  deleteVaultItem,
  loadVaultItems,
  recordLocalVaultMutation,
  syncVaultItems,
  updateVaultItem,
  vaultItemDisplaySubtitle,
  vaultItemDisplayTitle,
} from "@/lib/vaultItems";
import { VaultlockApiError } from "@vaultlock/shared/api";
import type { LoginItemPlaintext, NoteItemPlaintext, VaultItemType } from "@vaultlock/shared/types";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

interface VaultScreenProps {
  accessToken: string;
  email: string;
  onCreateFormOpenChange?: (isOpen: boolean) => void;
  onLock: () => void;
  onSessionExpired: () => void;
  onSignOut: () => void;
}

const GENERIC_VAULT_ERROR = "Couldn't load vault items. Try again.";
const GENERIC_SYNC_ERROR = "Couldn't sync vault items. Try again.";
const GENERIC_CREATE_ERROR = "Couldn't save this item. Try again.";
const GENERIC_UPDATE_ERROR = "Couldn't update this item. Try again.";
const GENERIC_DELETE_ERROR = "Couldn't delete this item. Try again.";
const ITEM_NOT_FOUND_ERROR = "This item was not found or you don't have access.";

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

function draftFromItem(item: DecryptedVaultItem): VaultCreateDraft {
  if (item.itemType === "login") {
    const login = item.plaintext as LoginItemPlaintext;
    return {
      createType: "login",
      loginDraft: {
        title: login.title ?? "",
        url: login.url ?? "",
        username: login.username ?? "",
        password: login.password ?? "",
        notes: login.notes ?? "",
      },
      noteDraft: emptyNoteDraft(),
    };
  }

  const note = item.plaintext as NoteItemPlaintext;
  return {
    createType: "note",
    loginDraft: emptyLoginDraft(),
    noteDraft: {
      title: note.title ?? "",
      content: note.content ?? "",
    },
  };
}

function loginPlaintextFromDraft(draft: LoginItemPlaintext): LoginItemPlaintext {
  return {
    title: draft.title?.trim() || undefined,
    url: draft.url?.trim() || undefined,
    username: draft.username?.trim() || undefined,
    password: draft.password || undefined,
    notes: draft.notes?.trim() || undefined,
  };
}

function notePlaintextFromDraft(draft: NoteItemPlaintext): NoteItemPlaintext {
  return {
    title: draft.title?.trim() || undefined,
    content: draft.content?.trim() || undefined,
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
  const isMountedRef = useRef(true);
  const accessTokenRef = useRef(accessToken);
  const onSessionExpiredRef = useRef(onSessionExpired);

  const [items, setItems] = useState<DecryptedVaultItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPasswordGeneratorOpen, setIsPasswordGeneratorOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DecryptedVaultItem | null>(null);
  const [activeSection, setActiveSection] = useState<VaultSection>("logins");
  const [searchQuery, setSearchQuery] = useState("");
  const [createType, setCreateType] = useState<VaultItemType>("login");
  const [editType, setEditType] = useState<VaultItemType>("login");
  const [loginDraft, setLoginDraft] = useState(emptyLoginDraft);
  const [noteDraft, setNoteDraft] = useState(emptyNoteDraft);
  const [editLoginDraft, setEditLoginDraft] = useState(emptyLoginDraft);
  const [editNoteDraft, setEditNoteDraft] = useState(emptyNoteDraft);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  accessTokenRef.current = accessToken;
  onSessionExpiredRef.current = onSessionExpired;

  const setCreateOpen = (next: boolean) => {
    setIsCreateOpen(next);
    onCreateFormOpenChange?.(
      next || isEditOpen || deleteTarget !== null || isPasswordGeneratorOpen,
    );
  };

  const setEditOpen = (next: boolean) => {
    setIsEditOpen(next);
    if (!next) {
      setEditItemId(null);
    }
    onCreateFormOpenChange?.(
      isCreateOpen || next || deleteTarget !== null || isPasswordGeneratorOpen,
    );
  };

  const setDeleteOpen = (item: DecryptedVaultItem | null) => {
    setDeleteTarget(item);
    onCreateFormOpenChange?.(
      isCreateOpen || isEditOpen || item !== null || isPasswordGeneratorOpen,
    );
  };

  const handleVaultMutationError = (
    mutationError: unknown,
    fallbackMessage: string,
    staleItemId?: string,
  ) => {
    if (mutationError instanceof VaultlockApiError) {
      if (mutationError.status === 401) {
        notifySessionExpired();
        return;
      }
      if (mutationError.status === 404) {
        toast.error(ITEM_NOT_FOUND_ERROR);
        if (staleItemId) {
          setItems((current) => current.filter((item) => item.id !== staleItemId));
        }
        setSelectedItemId(null);
        setEditOpen(false);
        setDeleteOpen(null);
        return;
      }
    }
    toast.error(fallbackMessage);
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

  const setLoginPassword = (password: string) => {
    setLoginDraft((current) => ({ ...current, password }));
  };

  const updateEditLoginField = (
    field: keyof LoginItemPlaintext,
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const value = event.target.value;
    setEditLoginDraft((current) => ({ ...current, [field]: value }));
  };

  const setEditLoginPassword = (password: string) => {
    setEditLoginDraft((current) => ({ ...current, password }));
  };

  const updateEditNoteField = (
    field: keyof NoteItemPlaintext,
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const value = event.target.value;
    setEditNoteDraft((current) => ({ ...current, [field]: value }));
  };

  const updateNoteField = (
    field: keyof NoteItemPlaintext,
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const value = event.target.value;
    setNoteDraft((current) => ({ ...current, [field]: value }));
  };

  const sortItems = (nextItems: DecryptedVaultItem[]) =>
    [...nextItems].sort((left, right) =>
      vaultItemDisplayTitle(left).localeCompare(vaultItemDisplayTitle(right)),
    );

  const applyLoadedItems = (nextItems: DecryptedVaultItem[]) => {
    setItems(nextItems);
    setSelectedItemId((current) =>
      current && nextItems.some((item) => item.id === current) ? current : null,
    );
  };

  const handleVaultRequestError = (requestError: unknown, fallbackMessage: string) => {
    if (requestError instanceof VaultlockApiError && requestError.status === 401) {
      notifySessionExpired();
      return;
    }
    toast.error(fallbackMessage);
  };

  const loadItems = async () => {
    if (!accessTokenRef.current) {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      notifySessionExpired();
      return;
    }

    setIsLoading(true);
    try {
      const nextItems = await loadVaultItems(accessTokenRef.current, email);
      if (!isMountedRef.current) {
        return;
      }
      applyLoadedItems(nextItems);
    } catch (loadError) {
      if (!isMountedRef.current) {
        return;
      }
      handleVaultRequestError(loadError, GENERIC_VAULT_ERROR);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const syncItems = async () => {
    if (!accessTokenRef.current) {
      notifySessionExpired();
      return;
    }

    setIsSyncing(true);
    try {
      const result = await syncVaultItems(accessTokenRef.current, email, items);
      if (!isMountedRef.current) {
        return;
      }
      if (result.changed) {
        applyLoadedItems(result.items);
        if (result.items.length > items.length) {
          toast.success("Vault synced. New items were added.");
        } else if (result.items.length > 0) {
          toast.success("Vault synced.");
        }
      } else {
        toast.success("Vault is up to date.");
      }
    } catch (syncError) {
      if (!isMountedRef.current) {
        return;
      }
      handleVaultRequestError(syncError, GENERIC_SYNC_ERROR);
    } finally {
      if (isMountedRef.current) {
        setIsSyncing(false);
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

  const sectionCounts = useMemo(
    () => ({
      logins: items.filter((item) => item.itemType === "login").length,
      notes: items.filter((item) => item.itemType === "note").length,
    }),
    [items],
  );

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

  const activeSectionItemType = SECTION_ITEM_TYPE[activeSection];
  const canCreateInSection = activeSectionItemType === "login" || activeSectionItemType === "note";

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
    resetCreateForm();
    setCreateOpen(true);
  };

  const openCreateLoginWithPassword = (password: string) => {
    setCreateType("login");
    setLoginDraft({ ...emptyLoginDraft(), password });
    setNoteDraft(emptyNoteDraft());
    setActiveSection("logins");
    setIsPasswordGeneratorOpen(false);
    setCreateOpen(true);
  };

  const openEditForm = (item: DecryptedVaultItem) => {
    const draft = draftFromItem(item);
    setEditItemId(item.id);
    setEditType(item.itemType);
    setEditLoginDraft(draft.loginDraft);
    setEditNoteDraft(draft.noteDraft);
    setEditOpen(true);
  };

  const handleSectionChange = (section: VaultSection) => {
    setActiveSection(section);
    setSearchQuery("");
    setSelectedItemId(null);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const created =
        createType === "login"
          ? await createVaultItem(
              accessTokenRef.current,
              "login",
              loginPlaintextFromDraft(loginDraft),
            )
          : await createVaultItem(
              accessTokenRef.current,
              "note",
              notePlaintextFromDraft(noteDraft),
            );

      if (!isMountedRef.current) {
        return;
      }

      const nextItems = sortItems([...items, created]);
      setItems(nextItems);
      await recordLocalVaultMutation(email, nextItems);
      setActiveSection(created.itemType === "note" ? "notes" : "logins");
      setSelectedItemId(created.id);
      setCreateOpen(false);
      resetCreateForm();
      toast.success("Item saved.");
    } catch (createError) {
      if (!isMountedRef.current) {
        return;
      }
      if (createError instanceof VaultlockApiError && createError.status === 401) {
        notifySessionExpired();
        return;
      }
      toast.error(GENERIC_CREATE_ERROR);
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editItemId) {
      return;
    }

    setIsSubmitting(true);

    try {
      const updated =
        editType === "login"
          ? await updateVaultItem(
              accessTokenRef.current,
              editItemId,
              "login",
              loginPlaintextFromDraft(editLoginDraft),
            )
          : await updateVaultItem(
              accessTokenRef.current,
              editItemId,
              "note",
              notePlaintextFromDraft(editNoteDraft),
            );

      if (!isMountedRef.current) {
        return;
      }

      const nextItems = sortItems(items.map((item) => (item.id === updated.id ? updated : item)));
      setItems(nextItems);
      await recordLocalVaultMutation(email, nextItems);
      setSelectedItemId(updated.id);
      setEditOpen(false);
      toast.success("Item updated.");
    } catch (updateError) {
      if (!isMountedRef.current) {
        return;
      }
      handleVaultMutationError(updateError, GENERIC_UPDATE_ERROR, editItemId);
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setIsSubmitting(true);

    try {
      await deleteVaultItem(accessTokenRef.current, deleteTarget.id);

      if (!isMountedRef.current) {
        return;
      }

      const nextItems = items.filter((item) => item.id !== deleteTarget.id);
      setItems(nextItems);
      await recordLocalVaultMutation(email, nextItems);
      if (selectedItemId === deleteTarget.id) {
        setSelectedItemId(null);
      }
      setDeleteOpen(null);
      toast.success("Item deleted.");
    } catch (deleteError) {
      if (!isMountedRef.current) {
        return;
      }
      handleVaultMutationError(deleteError, GENERIC_DELETE_ERROR, deleteTarget.id);
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
        sectionCounts={sectionCounts}
        onSectionChange={handleSectionChange}
        onNewItem={openCreateForm}
        onGeneratePassword={() => setIsPasswordGeneratorOpen(true)}
        onLock={onLock}
        onSignOut={onSignOut}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
          <VaultItemList
            items={filteredItems}
            selectedItemId={selectedItem?.id ?? selectedItemId}
            searchQuery={searchQuery}
            isLoading={isLoading}
            isSyncing={isSyncing}
            sectionLabel={SECTION_LABELS[activeSection]}
            sectionItemType={activeSectionItemType}
            onSearchChange={setSearchQuery}
            onSelectItem={setSelectedItemId}
            onSync={() => void syncItems()}
            onAddItem={canCreateInSection ? openCreateForm : undefined}
          />
          <VaultItemDetail
            item={selectedItem}
            isSubmitting={isSubmitting}
            onEdit={openEditForm}
            onDelete={setDeleteOpen}
          />
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
        onLoginPasswordChange={setLoginPassword}
        onNoteFieldChange={updateNoteField}
      />

      <VaultCreateDialog
        open={isEditOpen}
        mode="edit"
        isSubmitting={isSubmitting}
        draft={{ createType: editType, loginDraft: editLoginDraft, noteDraft: editNoteDraft }}
        onOpenChange={setEditOpen}
        onSubmit={handleUpdate}
        onCreateTypeChange={setEditType}
        onLoginFieldChange={updateEditLoginField}
        onLoginPasswordChange={setEditLoginPassword}
        onNoteFieldChange={updateEditNoteField}
      />

      <VaultDeleteDialog
        item={deleteTarget}
        isSubmitting={isSubmitting}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteOpen(null);
          }
        }}
        onConfirm={() => void handleDelete()}
      />

      <PasswordGeneratorDialog
        open={isPasswordGeneratorOpen}
        onOpenChange={setIsPasswordGeneratorOpen}
        onUseInNewLogin={openCreateLoginWithPassword}
      />
    </div>
  );
}
