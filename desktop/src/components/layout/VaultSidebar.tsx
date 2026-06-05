import { Badge } from "@vaultlock/ui/components/ui/badge";
import { Button } from "@vaultlock/ui/components/ui/button";
import { Separator } from "@vaultlock/ui/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@vaultlock/ui/components/ui/tooltip";
import { cn } from "@vaultlock/ui/lib/utils";
import {
  CreditCard,
  KeyRound,
  Lock,
  LogOut,
  NotebookPen,
  Plus,
  Settings,
  Star,
  Wand2,
} from "lucide-react";

export type VaultSection = "logins" | "notes" | "cards" | "favourites";

interface VaultSidebarProps {
  activeSection: VaultSection;
  email: string;
  sectionCounts?: Partial<Record<VaultSection, number>>;
  className?: string;
  onSectionChange: (section: VaultSection) => void;
  onNewItem: () => void;
  onGeneratePassword: () => void;
  onOpenSettings: () => void;
  onLock: () => void;
  onSignOut: () => void;
}

const NAV_ITEMS: Array<{
  id: VaultSection;
  label: string;
  icon: typeof KeyRound;
  disabled?: boolean;
  disabledHint?: string;
}> = [
  { id: "logins", label: "Logins", icon: KeyRound },
  {
    id: "cards",
    label: "Credit cards",
    icon: CreditCard,
    disabled: true,
    disabledHint: "Credit cards coming soon",
  },
  { id: "notes", label: "Notes", icon: NotebookPen },
  {
    id: "favourites",
    label: "Favourites",
    icon: Star,
    disabled: true,
    disabledHint: "Favourites coming soon",
  },
];

function NavButton({
  active,
  disabled,
  disabledHint,
  label,
  icon: Icon,
  count,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  disabledHint?: string;
  label: string;
  icon: typeof KeyRound;
  count?: number;
  onClick: () => void;
}) {
  const button = (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
      )}
      onClick={onClick}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {typeof count === "number" && count > 0 && !disabled && (
        <Badge
          variant={active ? "default" : "secondary"}
          className="h-5 min-w-5 shrink-0 justify-center px-1.5 text-[10px]"
        >
          {count > 99 ? "99+" : count}
        </Badge>
      )}
    </button>
  );

  if (disabled && disabledHint) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block w-full">{button}</span>
        </TooltipTrigger>
        <TooltipContent side="right">{disabledHint}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

export function VaultSidebar({
  activeSection,
  email,
  sectionCounts,
  className,
  onSectionChange,
  onNewItem,
  onGeneratePassword,
  onOpenSettings,
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
        {NAV_ITEMS.map(({ id, label, icon: Icon, disabled, disabledHint }) => (
          <NavButton
            key={id}
            active={activeSection === id}
            disabled={disabled}
            disabledHint={disabledHint}
            label={label}
            icon={Icon}
            count={sectionCounts?.[id]}
            onClick={() => onSectionChange(id)}
          />
        ))}
      </nav>

      <div className="mt-auto space-y-2 p-3">
        <div className="space-y-1.5">
          <Button className="w-full shadow-sm" size="sm" onClick={onNewItem}>
            <Plus className="size-4" aria-hidden />
            New item
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto w-full justify-start gap-3 rounded-md px-2 py-2 text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                onClick={onGeneratePassword}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary/15 text-sidebar-primary">
                  <Wand2 className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-medium leading-none">Password generator</span>
                  <span className="mt-1 block text-[11px] leading-none text-sidebar-foreground/60">
                    Random, copy, or new login
                  </span>
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Open the password generator</TooltipContent>
          </Tooltip>
        </div>
        <Separator className="bg-sidebar-border" />
        <Button className="w-full justify-start" variant="ghost" size="sm" onClick={onOpenSettings}>
          <Settings className="size-4" aria-hidden />
          Settings
        </Button>
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
