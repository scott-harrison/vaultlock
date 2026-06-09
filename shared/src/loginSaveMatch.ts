import { loginMatchesPageHost } from "./domainMatching";
import type { LoginItemPlaintext } from "./types";

export function loginCredentialMatchesPage(
  savedUrl: string | undefined,
  savedUsername: string | undefined,
  pageUrl: string,
  submittedUsername: string,
): boolean {
  let hostname: string;
  try {
    hostname = new URL(pageUrl).hostname;
  } catch {
    return false;
  }

  const normalizedSubmitted = submittedUsername.trim().toLowerCase();
  const normalizedSaved = (savedUsername ?? "").trim().toLowerCase();

  if (normalizedSubmitted && normalizedSaved && normalizedSaved !== normalizedSubmitted) {
    return false;
  }

  return loginMatchesPageHost(savedUrl, hostname);
}

export type SaveLoginDecision =
  | { kind: "skip" }
  | { kind: "save" }
  | { kind: "update"; itemId: string };

export interface VaultLoginItemRef {
  id: string;
  plaintext: LoginItemPlaintext;
}

export function findMatchingLoginCredential(
  username: string,
  pageUrl: string,
  items: VaultLoginItemRef[],
): VaultLoginItemRef | null {
  const normalizedSubmitted = username.trim().toLowerCase();
  const matches = items.filter((item) =>
    loginCredentialMatchesPage(item.plaintext.url, item.plaintext.username, pageUrl, username),
  );

  if (matches.length === 0) {
    return null;
  }

  if (normalizedSubmitted) {
    const exact = matches.find(
      (item) => (item.plaintext.username ?? "").trim().toLowerCase() === normalizedSubmitted,
    );
    if (exact) {
      return exact;
    }
  }

  return matches[0];
}

export function evaluateSaveLoginDecision(
  candidate: { username: string; password: string; pageUrl: string },
  items: VaultLoginItemRef[],
): SaveLoginDecision {
  const existing = findMatchingLoginCredential(candidate.username, candidate.pageUrl, items);
  if (!existing) {
    return { kind: "save" };
  }

  const savedPassword = existing.plaintext.password ?? "";
  if (candidate.password === savedPassword) {
    return { kind: "skip" };
  }

  return { kind: "update", itemId: existing.id };
}
