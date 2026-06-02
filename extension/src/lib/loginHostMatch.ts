/**
 * Basic hostname matching for login items vs. the page the user is filling on.
 */

export function loginMatchesPageHost(loginUrl: string | undefined, pageHostname: string): boolean {
  const host = pageHostname.toLowerCase();
  if (!loginUrl?.trim()) return true;

  try {
    const parsed = new URL(loginUrl.includes("://") ? loginUrl : `https://${loginUrl}`);
    const itemHost = parsed.hostname.toLowerCase();
    return itemHost === host || itemHost.endsWith(`.${host}`) || host.endsWith(`.${itemHost}`);
  } catch {
    return loginUrl.toLowerCase().includes(host);
  }
}
