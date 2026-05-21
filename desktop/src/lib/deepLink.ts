export type DeepLinkAction = { type: "verify"; token: string } | { type: "sign-in" };

/** Parses `vaultlock://verify?token=…` and `vaultlock://sign-in` deep links. */
export function parseDeepLinkAction(url: string): DeepLinkAction | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "vaultlock:") {
      return null;
    }

    const path = parsed.pathname.replace(/^\//, "");
    const host = parsed.hostname;

    if (host === "sign-in" || path === "sign-in") {
      return { type: "sign-in" };
    }

    const isVerifyHost = host === "verify";
    const isVerifyPath = path === "verify";
    if (!isVerifyHost && !isVerifyPath) {
      return null;
    }

    const token = parsed.searchParams.get("token")?.trim();
    return token ? { type: "verify", token } : null;
  } catch {
    return null;
  }
}

/** @deprecated Use {@link parseDeepLinkAction} */
export function parseVerifyTokenFromUrl(url: string): string | null {
  const action = parseDeepLinkAction(url);
  return action?.type === "verify" ? action.token : null;
}
