const HUSH_WEB_HOST = "chat.hushnetwork.social";
const HUSH_APP_SCHEME = "hushfeeds";

function withQueryAndHash(pathname: string, search: string, hash: string): string {
  return `${pathname}${search}${hash}`;
}

export function buildTauriPostDeepLink(postId: string): string {
  return `${HUSH_APP_SCHEME}://social/post/${encodeURIComponent(postId)}`;
}

export function resolveSupportedDeepLinkPath(urlString: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return null;
  }

  if (parsed.protocol === `${HUSH_APP_SCHEME}:`) {
    if (parsed.host === "social" && parsed.pathname.startsWith("/post/")) {
      return withQueryAndHash(`/social${parsed.pathname}`, parsed.search, parsed.hash);
    }

    if (parsed.host === "join") {
      return withQueryAndHash(`/join${parsed.pathname}`, parsed.search, parsed.hash);
    }

    if (parsed.pathname.startsWith("/social/post/") || parsed.pathname.startsWith("/join/")) {
      return withQueryAndHash(parsed.pathname, parsed.search, parsed.hash);
    }

    return null;
  }

  if ((parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.host === HUSH_WEB_HOST) {
    if (parsed.pathname.startsWith("/social/post/") || parsed.pathname.startsWith("/join/")) {
      return withQueryAndHash(parsed.pathname, parsed.search, parsed.hash);
    }
  }

  return null;
}

