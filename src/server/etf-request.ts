/** Bound optional upstream work so published ETF data remains usable during outages. */
export async function withEtfDeadline<T>(
  lookup: (signal: AbortSignal) => Promise<T>,
  fallback: T,
  timeoutMs = 6_000,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(fallback);
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => lookup(controller.signal)).catch(() => fallback),
      expired,
    ]);
  } finally {
    clearTimeout(timer);
  }
}
