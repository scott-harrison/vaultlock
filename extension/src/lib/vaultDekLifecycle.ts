import { clearDekFromSession, persistDekToSession } from "./vaultDekSession";
import { lockVaultDek, restoreUnlockedDek } from "./vaultDekState";
import { persistVaultUnlockSession } from "./vaultUnlockSession";

export function applyUnlockedDek(dek: Uint8Array): void {
  restoreUnlockedDek(dek);
  void persistVaultUnlockSession(true);
  void persistDekToSession(dek);
}

export function clearUnlockedDek(): void {
  lockVaultDek();
  void persistVaultUnlockSession(false);
  void clearDekFromSession();
}
