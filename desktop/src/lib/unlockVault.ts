import { loadCredentials, saveCredentials } from "./authSession";
import { unlockVault } from "./vaultSession";

const INVALID_CREDENTIALS = "Couldn't verify your master password.";
const LOCAL_KEYS_ERROR =
  "Couldn't decrypt local vault keys on this device. Sign out, then sign in again. If this continues, remove local vault data for this account.";

export async function unlockVaultForUser(
  email: string,
  masterPassword: string,
  masterPasswordHashFromLogin?: string,
  wrappedDekFromLogin?: Record<string, unknown>,
): Promise<{ generatedNewDek: boolean }> {
  const normalizedEmail = email.trim().toLowerCase();
  let masterPasswordHash = masterPasswordHashFromLogin?.trim();

  if (!masterPasswordHash) {
    const credentials = await loadCredentials();
    if (!credentials || credentials.email.trim().toLowerCase() !== normalizedEmail) {
      throw new Error(INVALID_CREDENTIALS);
    }
    masterPasswordHash = credentials.masterPasswordHash;
  } else {
    await saveCredentials({ email: normalizedEmail, masterPasswordHash });
  }

  try {
    const result = await unlockVault({
      email: normalizedEmail,
      masterPassword,
      masterPasswordHash,
      wrappedDekFromServer: wrappedDekFromLogin,
    });
    return result; // propagate whether we generated a new DEK
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid master password") {
      throw new Error(INVALID_CREDENTIALS);
    }
    if (
      (error instanceof DOMException && error.name === "OperationError") ||
      (error instanceof Error && error.message.includes("Local vault keys"))
    ) {
      throw new Error(LOCAL_KEYS_ERROR);
    }
    throw error;
  }
}

export { INVALID_CREDENTIALS as VAULT_UNLOCK_ERROR, LOCAL_KEYS_ERROR as VAULT_LOCAL_KEYS_ERROR };
