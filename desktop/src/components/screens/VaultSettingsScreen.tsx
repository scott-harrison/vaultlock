import { SecuritySettingsSection } from "@/components/settings/SecuritySettingsSection";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface VaultSettingsScreenProps {
  email: string;
  onClose: () => void;
}

export function VaultSettingsScreen({ email, onClose }: VaultSettingsScreenProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={onClose}>
            <ArrowLeft className="size-4" aria-hidden />
            Back
          </Button>
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl space-y-8 p-6">
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Security</h2>
            <p className="text-sm text-muted-foreground">
              Control how you unlock Vaultlock on this device.
            </p>
          </div>
          <SecuritySettingsSection email={email} />
        </section>
      </div>
    </div>
  );
}
