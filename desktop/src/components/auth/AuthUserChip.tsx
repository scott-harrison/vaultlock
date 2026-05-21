import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeftRight } from "lucide-react";

interface AuthUserChipProps {
  email: string;
  onSwitchAccount: () => void;
}

function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  if (local.length >= 2) {
    return local.slice(0, 2).toUpperCase();
  }
  return email.charAt(0).toUpperCase();
}

export function AuthUserChip({ email, onSwitchAccount }: AuthUserChipProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary"
          aria-hidden
        >
          {initialsFromEmail(email)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{email}</p>
          <p className="text-xs text-muted-foreground">Personal</p>
        </div>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Switch account"
            onClick={onSwitchAccount}
          >
            <ArrowLeftRight className="size-4" aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Switch account</TooltipContent>
      </Tooltip>
    </div>
  );
}
