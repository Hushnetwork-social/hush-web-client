import { useEffect } from "react";
import { debugError, debugLog } from "@/lib/debug-logger";
import { isTauri } from "@/lib/platform";
import { resolveSupportedDeepLinkPath } from "@/lib/deepLinks";

function navigateToDeepLink(url: string): void {
  const path = resolveSupportedDeepLinkPath(url);
  if (!path) {
    return;
  }

  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current === path) {
    return;
  }

  debugLog(`[DeepLink] Navigating to ${path}`);
  window.location.href = path;
}

export function useDeepLinkNavigation(): void {
  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    let unsubscribe: (() => void) | null = null;

    const setup = async () => {
      try {
        const { getCurrent, onOpenUrl } = await import("@tauri-apps/plugin-deep-link");

        const currentUrls = await getCurrent();
        currentUrls?.forEach(navigateToDeepLink);

        unsubscribe = await onOpenUrl((urls) => {
          urls.forEach(navigateToDeepLink);
        });
      } catch (error) {
        debugError("[DeepLink] Failed to initialize deep-link listener:", error);
      }
    };

    void setup();

    return () => {
      unsubscribe?.();
    };
  }, []);
}
