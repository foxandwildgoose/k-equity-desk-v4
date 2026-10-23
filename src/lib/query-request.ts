/** Bound the complete server-function call, including response-body decoding. */
export const CRITICAL_QUERY_TIMEOUT_MS = 20_000;

export class QueryRequestTimeoutError extends Error {
  constructor() {
    super("서버 응답이 지연되어 조회를 중단했습니다. 잠시 후 다시 시도해 주세요.");
    this.name = "TimeoutError";
  }
}

export async function withQueryDeadline<T>(
  request: (signal: AbortSignal) => Promise<T>,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T> {
  const parent = options.signal;
  const cancelled = () => parent?.reason instanceof Error
    ? parent.reason
    : new DOMException("요청이 취소되었습니다.", "AbortError");
  if (parent?.aborted) throw cancelled();

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const interrupted = new Promise<never>((_, reject) => {
    const stop = (error: Error) => {
      // Settle the query even if a transport or decoder fails to reject after
      // cancellation; the same signal still cancels its underlying fetch/body.
      reject(error);
      controller.abort(error);
    };
    onAbort = () => stop(cancelled());
    parent?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => stop(new QueryRequestTimeoutError()), Math.max(1, options.timeoutMs ?? CRITICAL_QUERY_TIMEOUT_MS));
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => request(controller.signal)),
      interrupted,
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    if (onAbort) parent?.removeEventListener("abort", onAbort);
  }
}
