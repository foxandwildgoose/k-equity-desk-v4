interface RecoveryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ClientRecoveryHost {
  readonly sessionStorage: RecoveryStorage;
  readonly location: { readonly pathname: string; reload(): void };
}

const RELOAD_KEY = "k-equity:chunk-recovery:";
const installedWindows = new WeakSet<Window>();

export function clientErrorMessage(error: unknown): string {
  try {
    if (typeof error === "string" && error.trim()) return error;
    if (error && typeof error === "object" && "message" in error) {
      const message = error.message;
      if (typeof message === "string" && message.trim()) return message;
    }
  } catch {
    // A malformed thrown value must not crash the error screen itself.
  }
  return "알 수 없는 오류가 발생했습니다.";
}

/** Ordinary fetch/API failures are deliberately excluded from automatic reloads. */
export function isClientChunkFailure(error: unknown): boolean {
  const message = clientErrorMessage(error);
  try {
    if (error && typeof error === "object" && "name" in error && error.name === "ChunkLoadError") {
      return true;
    }
  } catch {
    return false;
  }
  return /(?:failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|loading (?:css )?chunk [\s\S]*?failed|unable to preload css for)/i.test(message);
}

/**
 * Recover at most once per path in this tab. A memory-only guard would disappear
 * on reload and loop when storage is blocked, so those browsers use manual retry.
 */
export function tryAutomaticChunkRecovery(error: unknown, host: ClientRecoveryHost): boolean {
  if (!isClientChunkFailure(error)) return false;
  try {
    const storage = host.sessionStorage;
    const key = RELOAD_KEY + (host.location.pathname || "/");
    if (storage.getItem(key) !== null) return false;
    storage.setItem(key, "attempted");
    // Some restricted WebViews silently ignore writes rather than throwing.
    if (storage.getItem(key) !== "attempted") return false;
    host.location.reload();
    return true;
  } catch {
    return false;
  }
}

export function installClientRecovery(
  host: Window | undefined = typeof window === "undefined" ? undefined : window,
): void {
  if (!host || installedWindows.has(host)) return;
  installedWindows.add(host);
  host.addEventListener("vite:preloadError", (event: Event) => {
    const payload = (event as Event & { payload?: unknown }).payload;
    if (tryAutomaticChunkRecovery(payload, host)) event.preventDefault();
  });
  host.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    if (tryAutomaticChunkRecovery(event.reason, host)) event.preventDefault();
  });
}
