import { getStorageSession } from "./browser";
import type { SaveLoginCandidate } from "./messaging";

const DISMISS_TTL_MS = 30 * 60 * 1000;
const DISMISS_KEY_PREFIX = "vaultlock:saveDismissed:";
const BANNER_KEY_PREFIX = "pendingSaveLoginBanner:";

export interface PendingSaveLoginBannerRecord {
  candidate: SaveLoginCandidate;
  createdAt: number;
}

function bannerKey(tabId: number): string {
  return `${BANNER_KEY_PREFIX}${tabId}`;
}

function dismissKey(origin: string): string {
  return `${DISMISS_KEY_PREFIX}${origin}`;
}

export function originForCandidate(candidate: SaveLoginCandidate): string {
  try {
    return new URL(candidate.pageUrl).origin;
  } catch {
    return `https://${candidate.hostname}`;
  }
}

export async function isSaveLoginDismissed(origin: string): Promise<boolean> {
  try {
    const result = await getStorageSession()?.get(dismissKey(origin));
    const dismissedAt = Number(result?.[dismissKey(origin)]);
    if (!Number.isFinite(dismissedAt)) {
      return false;
    }
    return Date.now() - dismissedAt < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

export async function rememberSaveLoginDismissed(origin: string): Promise<void> {
  try {
    await getStorageSession()?.set({ [dismissKey(origin)]: Date.now() });
  } catch {
    // ignore
  }
}

export async function persistPendingSaveLoginBanner(
  tabId: number,
  candidate: SaveLoginCandidate,
): Promise<void> {
  const record: PendingSaveLoginBannerRecord = {
    candidate,
    createdAt: Date.now(),
  };
  await getStorageSession()?.set({ [bannerKey(tabId)]: record });
}

export async function getPendingSaveLoginBanner(
  tabId: number,
): Promise<PendingSaveLoginBannerRecord | null> {
  try {
    const result = await getStorageSession()?.get(bannerKey(tabId));
    const record = result?.[bannerKey(tabId)] as PendingSaveLoginBannerRecord | undefined;
    if (!record?.candidate?.password) {
      return null;
    }
    return record;
  } catch {
    return null;
  }
}

export async function clearPendingSaveLoginBanner(tabId: number): Promise<void> {
  try {
    await getStorageSession()?.remove(bannerKey(tabId));
  } catch {
    // ignore
  }
}
