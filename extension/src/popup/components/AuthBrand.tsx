import { Lock } from "lucide-react";

export function AuthBrand() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Lock className="size-3.5" aria-hidden />
      </div>
      <span className="text-base font-semibold tracking-tight">VaultLock</span>
    </div>
  );
}
