/**
 * Hostname matching for login items vs. the page the user is filling on.
 *
 * Phase 1: exact hostname + subdomain rules.
 * Phase 2 (#198): pass per-login `relatedDomains` via LoginMatchOptions.
 */

export type LoginMatchKind = "exact" | "subdomain" | "related" | "no_url";

export interface LoginHostMatchResult {
  matches: boolean;
  kind: LoginMatchKind | null;
  /** Lower score = stronger match (for sorting). */
  score: number;
}

export interface LoginMatchOptions {
  /** User-managed related hostnames for this login (Phase 2). */
  relatedDomains?: readonly string[];
}

const SCORE_EXACT = 0;
const SCORE_SUBDOMAIN_BASE = 10;
const SCORE_RELATED_BASE = 100;
const SCORE_NO_URL = 200;
const SCORE_LOOSE_FALLBACK = 250;

export function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, "");
}

export function extractLoginHostname(loginUrl: string | undefined): string | null {
  if (!loginUrl?.trim()) {
    return null;
  }

  try {
    const parsed = new URL(loginUrl.includes("://") ? loginUrl : `https://${loginUrl}`);
    const host = parsed.hostname.trim();
    return host ? normalizeHostname(host) : null;
  } catch {
    return null;
  }
}

function countExtraLabels(longerHost: string, shorterHost: string): number {
  return longerHost.split(".").length - shorterHost.split(".").length;
}

function subdomainRelationship(itemHost: string, pageHost: string): { extraLabels: number } | null {
  if (itemHost === pageHost) {
    return { extraLabels: 0 };
  }

  if (itemHost.endsWith(`.${pageHost}`)) {
    return { extraLabels: countExtraLabels(itemHost, pageHost) };
  }

  if (pageHost.endsWith(`.${itemHost}`)) {
    return { extraLabels: countExtraLabels(pageHost, itemHost) };
  }

  return null;
}

function matchesRelatedDomain(
  relatedDomain: string,
  pageHost: string,
): { extraLabels: number } | null {
  const relatedHost = normalizeHostname(relatedDomain);
  if (!relatedHost) {
    return null;
  }

  return subdomainRelationship(relatedHost, pageHost);
}

export function scoreLoginForPageHost(
  loginUrl: string | undefined,
  pageHostname: string,
  options?: LoginMatchOptions,
): LoginHostMatchResult {
  const pageHost = normalizeHostname(pageHostname);
  if (!pageHost) {
    return { matches: false, kind: null, score: Number.POSITIVE_INFINITY };
  }

  const itemHost = extractLoginHostname(loginUrl);
  if (!itemHost) {
    return { matches: true, kind: "no_url", score: SCORE_NO_URL };
  }

  if (itemHost === pageHost) {
    return { matches: true, kind: "exact", score: SCORE_EXACT };
  }

  const subdomain = subdomainRelationship(itemHost, pageHost);
  if (subdomain) {
    return {
      matches: true,
      kind: "subdomain",
      score: SCORE_SUBDOMAIN_BASE + subdomain.extraLabels,
    };
  }

  for (const relatedDomain of options?.relatedDomains ?? []) {
    const related = matchesRelatedDomain(relatedDomain, pageHost);
    if (related) {
      return {
        matches: true,
        kind: "related",
        score: SCORE_RELATED_BASE + related.extraLabels,
      };
    }
  }

  if (loginUrl?.trim()) {
    const loose = loginUrl.toLowerCase().includes(pageHost);
    if (loose) {
      return { matches: true, kind: "subdomain", score: SCORE_LOOSE_FALLBACK };
    }
  }

  return { matches: false, kind: null, score: Number.POSITIVE_INFINITY };
}

export function loginMatchesPageHost(
  loginUrl: string | undefined,
  pageHostname: string,
  options?: LoginMatchOptions,
): boolean {
  return scoreLoginForPageHost(loginUrl, pageHostname, options).matches;
}

export function compareLoginMatchScores(a: LoginHostMatchResult, b: LoginHostMatchResult): number {
  if (a.score !== b.score) {
    return a.score - b.score;
  }

  const kindOrder: Record<LoginMatchKind, number> = {
    exact: 0,
    subdomain: 1,
    related: 2,
    no_url: 3,
  };

  const aKind = a.kind ? kindOrder[a.kind] : 99;
  const bKind = b.kind ? kindOrder[b.kind] : 99;
  return aKind - bKind;
}

export function sortLoginUrlsForPageHost(
  entries: readonly { url: string | undefined; relatedDomains?: readonly string[] }[],
  pageHostname: string,
): number[] {
  const scored = entries.map((entry, index) => ({
    index,
    result: scoreLoginForPageHost(entry.url, pageHostname, {
      relatedDomains: entry.relatedDomains,
    }),
  }));

  scored.sort((a, b) => {
    if (!a.result.matches && !b.result.matches) {
      return a.index - b.index;
    }
    if (!a.result.matches) {
      return 1;
    }
    if (!b.result.matches) {
      return -1;
    }
    const byScore = compareLoginMatchScores(a.result, b.result);
    return byScore !== 0 ? byScore : a.index - b.index;
  });

  return scored.map((entry) => entry.index);
}
