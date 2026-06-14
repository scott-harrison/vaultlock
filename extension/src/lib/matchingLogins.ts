import {
  compareLoginMatchScores,
  loginMatchOptionsFromLogin,
  scoreLoginForPageHost,
} from "@vaultlock/shared/domain-matching";
import type { LoginItemPlaintext, VaultItemResponse } from "@vaultlock/shared/types";
import { getEncryptedVaultCache } from "./storage";
import { applyUnlockedDek } from "./vaultDekLifecycle";
import { loadDekFromSession } from "./vaultDekSession";
import { isVaultUnlocked } from "./vaultDekState";
import { decryptVaultItem } from "./vaultItemCrypto";
import { isVaultUnlockedInSession } from "./vaultUnlockSession";

export interface MatchingLoginPreview {
  id: string;
  title: string;
  username: string;
  password: string;
  matchKind: ReturnType<typeof scoreLoginForPageHost>["kind"];
}

export type MatchingLoginsStatus = "locked" | "unavailable" | "ready";

export interface MatchingLoginsResult {
  status: MatchingLoginsStatus;
  matches: MatchingLoginPreview[];
}

async function ensureDecryptionReady(): Promise<MatchingLoginsStatus> {
  if (!isVaultUnlocked()) {
    const sessionDek = await loadDekFromSession();
    if (sessionDek) {
      applyUnlockedDek(sessionDek);
    }
  }

  if (isVaultUnlocked()) {
    return "ready";
  }

  if (!(await isVaultUnlockedInSession())) {
    return "locked";
  }

  chrome.runtime.sendMessage({ type: "REQUEST_VAULT_DEK_SYNC" }).catch(() => {});
  return "unavailable";
}

function toPreview(
  item: VaultItemResponse,
  plaintext: LoginItemPlaintext,
  match: ReturnType<typeof scoreLoginForPageHost>,
): MatchingLoginPreview {
  return {
    id: item.id,
    title: plaintext.title?.trim() || "Untitled login",
    username: plaintext.username?.trim() || "",
    password: plaintext.password ?? "",
    matchKind: match.kind,
  };
}

export async function listMatchingLoginsForHost(hostname: string): Promise<MatchingLoginsResult> {
  const readiness = await ensureDecryptionReady();
  if (readiness !== "ready") {
    return { status: readiness, matches: [] };
  }

  const cache = await getEncryptedVaultCache();
  const encryptedItems = cache?.items ?? [];
  if (encryptedItems.length === 0) {
    return { status: "ready", matches: [] };
  }

  const scored: Array<{
    preview: MatchingLoginPreview;
    match: ReturnType<typeof scoreLoginForPageHost>;
  }> = [];

  for (const item of encryptedItems) {
    if (item.item_type !== "login") {
      continue;
    }

    try {
      const plaintext = (await decryptVaultItem(item)) as LoginItemPlaintext;
      const match = scoreLoginForPageHost(
        plaintext.url,
        hostname,
        loginMatchOptionsFromLogin(plaintext),
      );
      if (!match.matches) {
        continue;
      }

      scored.push({
        preview: toPreview(item, plaintext, match),
        match,
      });
    } catch {
      // Skip items that cannot be decrypted with the current unlock key.
    }
  }

  scored.sort((a, b) => compareLoginMatchScores(a.match, b.match));

  return {
    status: "ready",
    matches: scored.map(({ preview }) => preview),
  };
}

export async function decryptMatchingLogin(
  itemId: string,
  hostname: string,
): Promise<LoginItemPlaintext | null> {
  const readiness = await ensureDecryptionReady();
  if (readiness !== "ready") {
    return null;
  }

  const cache = await getEncryptedVaultCache();
  const item = cache?.items.find((entry) => entry.id === itemId);
  if (!item || item.item_type !== "login") {
    return null;
  }

  try {
    const plaintext = (await decryptVaultItem(item)) as LoginItemPlaintext;
    const match = scoreLoginForPageHost(
      plaintext.url,
      hostname,
      loginMatchOptionsFromLogin(plaintext),
    );
    if (!match.matches) {
      return null;
    }
    return plaintext;
  } catch {
    return null;
  }
}
