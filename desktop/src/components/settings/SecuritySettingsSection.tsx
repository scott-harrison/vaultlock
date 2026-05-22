import { useMountEffect } from "@/hooks/useMountEffect";
import {
  type BiometricUnlockStatus,
  formatBiometryError,
  getBiometricUnlockStatus,
} from "@/lib/biometricUnlock";
import {
  disableBiometricQuickUnlock,
  enableBiometricQuickUnlock,
} from "@/lib/biometricVaultUnlock";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";

interface SecuritySettingsSectionProps {
  email: string;
}

export function SecuritySettingsSection({ email }: SecuritySettingsSectionProps) {
  const [status, setStatus] = useState<BiometricUnlockStatus>({
    available: false,
    enabled: false,
    label: "Biometrics",
    usesDevFallback: false,
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = async () => {
    setStatus(await getBiometricUnlockStatus(email));
  };

  useMountEffect(() => {
    let cancelled = false;

    void getBiometricUnlockStatus(email).then((next) => {
      if (!cancelled) {
        setStatus(next);
      }
    });

    return () => {
      cancelled = true;
    };
  });

  const handleToggle = async (nextEnabled: boolean) => {
    setIsUpdating(true);
    setError(null);

    try {
      if (nextEnabled) {
        await enableBiometricQuickUnlock(email);
        toast.success(`${status.label} quick unlock enabled.`);
      } else {
        await disableBiometricQuickUnlock(email);
        toast.success(`${status.label} quick unlock disabled.`);
      }
      await refreshStatus();
    } catch (error) {
      setError(formatBiometryError(error, status.label));
    } finally {
      setIsUpdating(false);
    }
  };

  if (!status.available) {
    return (
      <p className="text-sm text-muted-foreground">
        Biometric quick unlock is not available on this device.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">{status.label} quick unlock</p>
          <p className="text-sm text-muted-foreground">
            Unlock the vault on this device with {status.label}. Your master password is still
            required on new devices and when biometrics are unavailable.
          </p>
        </div>
        <label
          className={cn(
            "relative inline-flex shrink-0 cursor-pointer items-center",
            isUpdating && "cursor-not-allowed opacity-60",
          )}
        >
          <input
            type="checkbox"
            className="peer sr-only"
            checked={status.enabled}
            disabled={isUpdating}
            onChange={(event) => void handleToggle(event.target.checked)}
          />
          <span className="h-6 w-11 rounded-full bg-muted transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2" />
          <span className="pointer-events-none absolute left-0.5 top-0.5 size-5 rounded-full bg-background shadow transition-transform peer-checked:translate-x-5" />
          <span className="sr-only">
            {status.enabled ? "Disable" : "Enable"} {status.label} quick unlock
          </span>
        </label>
      </div>
      {status.usesDevFallback && (
        <p className="mt-3 text-sm text-muted-foreground">
          Using local dev storage because the system keychain is unavailable in unsigned dev builds.
          Production builds use the secure keychain.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  );
}
