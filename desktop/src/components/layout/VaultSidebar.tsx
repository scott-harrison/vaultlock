import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { CreditCard, KeyRound, Lock, NotebookPen, Plus, Star } from "lucide-react";
import type { ReactNode } from "react";

interface VaultSidebarProps {
  activeSection?: "logins" | "notes" | "cards" | "favourites";
  className?: string;
  footer?: ReactNode;
}

const NAV_ITEMS = [
  { id: "logins" as const, label: "Logins", icon: KeyRound },
  { id: "cards" as const, label: "Credit cards", icon: CreditCard, disabled: true },
  { id: "notes" as const, label: "Notes", icon: NotebookPen },
  { id: "favourites" as const, label: "Favourites", icon: Star, disabled: true },
];

export function VaultSidebar({ activeSection = "logins", className, footer }: VaultSidebarProps) {
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
        <span className="text-sm font-semibold tracking-tight">Vaultlock</span>
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
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 p-3">
        {footer}
        <Button className="w-full" size="sm">
          <Plus className="size-4" aria-hidden />
          New item
        </Button>
      </div>
    </aside>
  );
}

export function VaultSidebarDivider() {
  return <Separator className="bg-sidebar-border" />;
}
