import { VaultlockApiError } from "@vaultlock/shared/api";
import type { AuthSession } from "./authSession";

export async function withAccessTokenRetry<T>(
  accessToken: string,
  refreshSession: () => Promise<AuthSession | null>,
  operation: (token: string) => Promise<T>,
): Promise<T> {
  try {
    return await operation(accessToken);
  } catch (error) {
    if (!(error instanceof VaultlockApiError && error.status === 401)) {
      throw error;
    }

    const refreshed = await refreshSession();
    if (!refreshed?.accessToken) {
      throw error;
    }

    return operation(refreshed.accessToken);
  }
}
