import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { CreditCard, KeyRound, Lock, LogOut, NotebookPen, Plus, Star } from "lucide-react";

export type VaultSection = "logins" | "notes" | "cards" | "favourites";

interface VaultSidebarProps {
  activeSection: VaultSection;
  email: string;
  className?: string;
  onSectionChange: (section: VaultSection) => void;
  onNewItem: () => void;
  onLock: () => void;
  onSignOut: () => void;
}

const NAV_ITEMS: Array<{
  id: VaultSection;
  label: string;
  icon: typeof KeyRound;
  disabled?: boolean;
}> = [
  { id: "logins", label: "Logins", icon: KeyRound },
  { id: "cards", label: "Credit cards", icon: CreditCard, disabled: true },
  { id: "notes", label: "Notes", icon: NotebookPen },
  { id: "favourites", label: "Favourites", icon: Star, disabled: true },
];

export function VaultSidebar({
  activeSection,
  email,
  className,
  onSectionChange,
  onNewItem,
  onLock,
  onSignOut,
}: VaultSidebarProps) {
  return (
    <aside
      data-slot="vault-sidebar"
      className={cn(
        "flex h-full w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        className,
      )}
    >
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
          <Lock className="size-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold tracking-tight">Vaultlock</div>
          <div className="truncate text-xs text-sidebar-foreground/70">{email}</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2">
        {NAV_ITEMS.map(({ id, label, icon: Icon, disabled }) => {
          const active = activeSection === id;
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
              )}
              onClick={() => onSectionChange(id)}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-2 p-3">
        <Button className="w-full" size="sm" onClick={onNewItem}>
          <Plus className="size-4" aria-hidden />
          New item
        </Button>
        <Separator className="bg-sidebar-border" />
        <Button className="w-full justify-start" variant="ghost" size="sm" onClick={onLock}>
          <Lock className="size-4" aria-hidden />
          Lock vault
        </Button>
        <Button className="w-full justify-start" variant="ghost" size="sm" onClick={onSignOut}>
          <LogOut className="size-4" aria-hidden />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
