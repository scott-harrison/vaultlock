import { loadCredentials } from "./authSession";
import { unlockVault } from "./vaultSession";

const INVALID_CREDENTIALS = "Couldn't verify your master password.";

export async function unlockVaultForUser(email: string, masterPassword: string): Promise<void> {
  const credentials = await loadCredentials();
  const normalizedEmail = email.trim().toLowerCase();

  if (!credentials || credentials.email.trim().toLowerCase() !== normalizedEmail) {
    throw new Error(INVALID_CREDENTIALS);
  }

  try {
    await unlockVault({
      email: normalizedEmail,
      masterPassword,
      masterPasswordHash: credentials.masterPasswordHash,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid master password") {
      throw new Error(INVALID_CREDENTIALS);
    }
    throw error;
  }
}

export { INVALID_CREDENTIALS as VAULT_UNLOCK_ERROR };
