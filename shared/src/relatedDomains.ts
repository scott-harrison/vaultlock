import { extractLoginHostname, normalizeHostname } from "./domainMatching";

const DOMAIN_SPLIT = /[\s,]+/;

export function normalizeRelatedDomainEntry(entry: string): string | null {
  const trimmed = entry.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("*.")) {
    const suffix = normalizeHostname(trimmed.slice(2));
    if (!suffix || !suffix.includes(".")) {
      return null;
    }
    return `*.${suffix}`;
  }

  const host = extractLoginHostname(trimmed) ?? normalizeHostname(trimmed);
  return host || null;
}

export function normalizeRelatedDomainList(
  entries: readonly string[] | undefined,
): string[] | undefined {
  if (!entries?.length) {
    return undefined;
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const entry of entries) {
    const host = normalizeRelatedDomainEntry(entry);
    if (!host || seen.has(host)) {
      continue;
    }
    seen.add(host);
    normalized.push(host);
  }

  return normalized.length > 0 ? normalized : undefined;
}

export function parseRelatedDomainsInput(input: string): string[] | undefined {
  const parts = input
    .split(DOMAIN_SPLIT)
    .map((part) => part.trim())
    .filter(Boolean);
  return normalizeRelatedDomainList(parts);
}

export function formatRelatedDomainsForInput(domains: readonly string[] | undefined): string {
  return domains?.join(", ") ?? "";
}
