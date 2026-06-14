import { Lock } from "lucide-react";

export function AuthBrand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Lock className="size-4" aria-hidden />
      </div>
      <span className="text-lg font-semibold tracking-tight">Vaultlock</span>
    </div>
  );
}
