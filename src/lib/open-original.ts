/**
 * Popup-safe "원문" opening (D2 / F2.6 / F4.6).
 *
 * Browsers (notably iOS Safari) drop the click's user activation across an
 * `await`, so `window.open` after a server round-trip can be blocked. The fix:
 * open `about:blank` synchronously inside the click handler, resolve the URL,
 * then `w.opener = null; w.location.replace(url)`. If resolution fails, the
 * tab goes to the fallback page; if the popup itself was blocked, the caller
 * shows the resolved link (e.g. in a toast) so one more tap opens it.
 */

export interface PopupLike {
  opener: unknown;
  location: { replace: (url: string) => void };
  document?: { title: string; body?: { textContent: string | null } | null };
  close?: () => void;
}

export interface OpenerHost {
  open: (url: string, target: string, features?: string) => PopupLike | null;
}

function httpsOrHttp(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export interface OpenOriginalOptions {
  /** Used when resolution fails or returns nothing (e.g. the research page). */
  fallbackUrl: string;
  /** Called when the popup was blocked; receives the resolved URL. */
  onBlocked?: (url: string) => void;
  host?: OpenerHost;
  loadingText?: string;
}

/**
 * Call synchronously from a click handler. Returns a promise with the final
 * URL and whether a tab was opened.
 */
export function openOriginalWithResolver(
  resolve: () => Promise<string | null | undefined>,
  opts: OpenOriginalOptions,
): Promise<{ opened: boolean; url: string | null }> {
  const host: OpenerHost | undefined = opts.host ?? (typeof window !== "undefined" ? (window as unknown as OpenerHost) : undefined);
  // Must run before any await — keeps the user activation.
  const w = host ? host.open("about:blank", "_blank") : null;
  if (w?.document) {
    try {
      w.document.title = opts.loadingText ?? "원문 여는 중…";
      if (w.document.body) w.document.body.textContent = opts.loadingText ?? "원문 여는 중…";
    } catch {
      /* cross-origin or closed */
    }
  }
  return (async () => {
    let url: string | null = null;
    try {
      url = httpsOrHttp(await resolve());
    } catch {
      url = null;
    }
    const target = url ?? httpsOrHttp(opts.fallbackUrl);
    if (!target) {
      w?.close?.();
      return { opened: false, url: null };
    }
    if (!w) {
      opts.onBlocked?.(target);
      return { opened: false, url: target };
    }
    try {
      w.opener = null;
    } catch {
      /* ignore */
    }
    w.location.replace(target);
    return { opened: true, url: target };
  })();
}

/** Known URL: open directly (callers should prefer a real <a> element). */
export function openKnownUrl(url: string, host?: OpenerHost): boolean {
  const target = httpsOrHttp(url);
  const h = host ?? (typeof window !== "undefined" ? (window as unknown as OpenerHost) : undefined);
  if (!target || !h) return false;
  // `noopener` makes window.open return null even on success.
  h.open(target, "_blank", "noopener,noreferrer");
  return true;
}
