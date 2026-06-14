import { createAuthApiClient } from "./apiClient";
import { getCurrentWrappedDek } from "./vaultSession";

/**
 * Pushes the locally trusted wrapped_dek to the server after unlock.
 * Heals cases where another client overwrote the server copy with a different key.
 */
export async function syncLocalWrappedDekToServer(
  email: string,
  accessToken: string,
): Promise<void> {
  const wrapped = await getCurrentWrappedDek(email);
  if (!wrapped) {
    return;
  }

  const client = await createAuthApiClient();
  await client.saveWrappedDek(accessToken, {
    nonce: wrapped.nonce,
    ciphertext: wrapped.ciphertext,
  });
}
