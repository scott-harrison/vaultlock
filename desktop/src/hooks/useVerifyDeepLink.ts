import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { useEffect } from "react";
import { type DeepLinkAction, parseDeepLinkAction } from "../lib/deepLink";

export function useVerifyDeepLink(onDeepLink: (action: DeepLinkAction) => void): void {
  useEffect(() => {
    let cancelled = false;

    const handleUrls = (urls: string[]) => {
      if (cancelled) {
        return;
      }
      for (const url of urls) {
        const action = parseDeepLinkAction(url);
        if (action) {
          onDeepLink(action);
          return;
        }
      }
    };

    getCurrent()
      .then((urls) => {
        if (urls?.length) {
          handleUrls(urls);
        }
      })
      .catch(() => {
        // Deep links are unavailable outside the Tauri runtime.
      });

    let unlisten: (() => void) | undefined;
    onOpenUrl(handleUrls)
      .then((off) => {
        unlisten = off;
      })
      .catch(() => {
        // Deep links are unavailable outside the Tauri runtime.
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [onDeepLink]);
}
