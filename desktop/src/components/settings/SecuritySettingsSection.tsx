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
import {
  AUTO_LOCK_OPTIONS,
  DEFAULT_AUTO_LOCK_MINUTES,
  DEFAULT_MASTER_PASSWORD_REAUTH_DAYS,
  MASTER_PASSWORD_REAUTH_OPTIONS,
  loadAutoLockMinutes,
  loadMasterPasswordReauthDays,
  saveAutoLockMinutes,
  saveMasterPasswordReauthDays,
} from "@/lib/securitySettings";
import { cn } from "@vaultlock/ui/lib/utils";
import { useState } from "react";
import { toast } from "sonner";

interface SecuritySettingsSectionProps {
  email: string;
  onSettingsChange?: () => void;
}

const selectClassName =
  "flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function SecuritySettingsSection({ email, onSettingsChange }: SecuritySettingsSectionProps) {
  const [autoLockMinutes, setAutoLockMinutes] = useState(DEFAULT_AUTO_LOCK_MINUTES);
  const [masterPasswordReauthDays, setMasterPasswordReauthDays] = useState(
    DEFAULT_MASTER_PASSWORD_REAUTH_DAYS,
  );
  const [status, setStatus] = useState<BiometricUnlockStatus>({
    available: false,
    enabled: false,
    label: "Biometrics",
    usesDevFallback: false,
  });
  const [isUpdatingAutoLock, setIsUpdatingAutoLock] = useState(false);
  const [isUpdatingReauth, setIsUpdatingReauth] = useState(false);
  const [isUpdatingBiometric, setIsUpdatingBiometric] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = async () => {
    const [nextAutoLock, nextReauth, nextBiometric] = await Promise.all([
      loadAutoLockMinutes(),
      loadMasterPasswordReauthDays(),
      getBiometricUnlockStatus(email),
    ]);
    setAutoLockMinutes(nextAutoLock);
    setMasterPasswordReauthDays(nextReauth);
    setStatus(nextBiometric);
  };

  useMountEffect(() => {
    let cancelled = false;

    void refreshStatus().then(() => {
      if (cancelled) {
        return;
      }
    });

    return () => {
      cancelled = true;
    };
  });

  const handleAutoLockChange = async (minutes: number) => {
    setIsUpdatingAutoLock(true);
    try {
      const saved = await saveAutoLockMinutes(minutes);
      setAutoLockMinutes(saved);
      onSettingsChange?.();
      toast.success(saved === 0 ? "Auto-lock disabled." : "Auto-lock setting updated.");
    } finally {
      setIsUpdatingAutoLock(false);
    }
  };

  const handleReauthChange = async (days: number) => {
    setIsUpdatingReauth(true);
    try {
      const saved = await saveMasterPasswordReauthDays(days);
      setMasterPasswordReauthDays(saved);
      onSettingsChange?.();
      toast.success("Master password re-authentication setting updated.");
    } finally {
      setIsUpdatingReauth(false);
    }
  };

  const handleBiometricToggle = async (nextEnabled: boolean) => {
    setIsUpdatingBiometric(true);
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
    } catch (toggleError) {
      setError(formatBiometryError(toggleError, status.label));
    } finally {
      setIsUpdatingBiometric(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">Auto-lock</p>
            <p className="text-sm text-muted-foreground">
              Lock the vault after a period of inactivity while you are signed in.
            </p>
          </div>
          <select
            className={selectClassName}
            value={autoLockMinutes}
            disabled={isUpdatingAutoLock}
            onChange={(event) => void handleAutoLockChange(Number(event.target.value))}
          >
            {AUTO_LOCK_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">Master password re-authentication</p>
            <p className="text-sm text-muted-foreground">
              Require your master password periodically, even when biometric quick unlock is
              enabled.
            </p>
          </div>
          <select
            className={selectClassName}
            value={masterPasswordReauthDays}
            disabled={isUpdatingReauth}
            onChange={(event) => void handleReauthChange(Number(event.target.value))}
          >
            {MASTER_PASSWORD_REAUTH_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {status.available ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">{status.label} quick unlock</p>
              <p className="text-sm text-muted-foreground">
                Quick unlock uses {status.label} to access keys stored on this device only. Your
                master password is still required on new devices and when biometrics are
                unavailable.
              </p>
            </div>
            <label
              className={cn(
                "relative inline-flex shrink-0 cursor-pointer items-center",
                isUpdatingBiometric && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="checkbox"
                className="peer sr-only"
                checked={status.enabled}
                disabled={isUpdatingBiometric}
                onChange={(event) => void handleBiometricToggle(event.target.checked)}
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
              Using local dev storage because the system keychain is unavailable in unsigned dev
              builds. Production builds use the secure keychain.
            </p>
          )}
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Biometric quick unlock is not available on this device.
          </p>
        </div>
      )}
    </div>
  );
}
