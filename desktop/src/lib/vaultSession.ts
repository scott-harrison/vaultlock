/** Master password held in memory only while the vault is unlocked — never persisted. */
let unlockedMasterPassword: string | null = null;

export function setUnlockedMasterPassword(password: string): void {
  unlockedMasterPassword = password;
}

export function getUnlockedMasterPassword(): string | null {
  return unlockedMasterPassword;
}

export function clearUnlockedMasterPassword(): void {
  unlockedMasterPassword = null;
}
