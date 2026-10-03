import { toast } from "sonner";
import { openKnownUrl, openOriginalWithResolver } from "@/lib/open-original";

/** Popup blocked → show the resolved link; tapping the action is a fresh user gesture. */
export function toastBlockedOriginal(url: string) {
  toast("팝업이 차단되어 원문을 열지 못했습니다", {
    description: url,
    duration: 12_000,
    action: { label: "원문 열기", onClick: () => openKnownUrl(url) },
  });
}

/**
 * Click-handler helper (D2 / F2.6): known URL → open directly; otherwise open a
 * blank tab synchronously, resolve, then navigate it. MUST be called
 * synchronously from the click event (no `await` before it).
 */
export function openOriginal(opts: {
  knownUrl?: string | null;
  resolve?: () => Promise<string | null | undefined>;
  fallbackUrl: string;
}): Promise<{ opened: boolean; url: string | null }> {
  if (opts.knownUrl) {
    openKnownUrl(opts.knownUrl);
    return Promise.resolve({ opened: true, url: opts.knownUrl });
  }
  if (!opts.resolve) {
    openKnownUrl(opts.fallbackUrl);
    return Promise.resolve({ opened: true, url: opts.fallbackUrl });
  }
  return openOriginalWithResolver(opts.resolve, {
    fallbackUrl: opts.fallbackUrl,
    onBlocked: toastBlockedOriginal,
  });
}
