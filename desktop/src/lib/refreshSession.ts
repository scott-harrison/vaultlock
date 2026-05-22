import { VaultlockApiError } from "@vaultlock/shared/api";
import { createApiClient } from "./apiClient";
import { type AuthSession, saveSession, sessionFromAuthResponse } from "./authSession";

export async function refreshAuthSession(session: AuthSession): Promise<AuthSession> {
  const refreshToken = session.refreshToken.trim();
  if (!refreshToken) {
    throw new Error("Missing refresh token.");
  }

  const client = await createApiClient();
  const response = await client.refresh({ refresh_token: refreshToken });
  const next = sessionFromAuthResponse(session.email, response);
  await saveSession(next);
  return next;
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof VaultlockApiError && error.status === 401;
}
