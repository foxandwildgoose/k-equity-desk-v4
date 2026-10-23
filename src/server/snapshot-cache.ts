/** Per-worker admission for public snapshots; provider observation times stay in the payload. */
export function createSnapshotCache<T>(options: {
  load: () => Promise<T>;
  usable: (value: T) => boolean;
  reconcile?: (previous: T | undefined, next: T) => { data: T; stale: boolean; accepted?: boolean };
  ttlMs: number;
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  let saved: { data: T; at: number; stale: boolean } | undefined;
  let pending: Promise<{ data: T; fetchedAt: string; cached: boolean; stale: boolean }> | undefined;
  const result = (entry: { data: T; at: number }, cached: boolean, stale: boolean) => ({
    data: entry.data,
    fetchedAt: new Date(entry.at).toISOString(),
    cached,
    stale,
  });
  return async function snapshot() {
    if (saved && now() - saved.at < options.ttlMs) return result(saved, true, saved.stale);
    if (pending) return pending;
    pending = (async () => {
      try {
        const data = await options.load();
        if (options.usable(data)) {
          const reconciled: { data: T; stale: boolean; accepted?: boolean } = options.reconcile?.(saved?.data, data) ?? { data, stale: false };
          if (reconciled.accepted === false) {
            return saved ? result(saved, true, true) : result({ data: reconciled.data, at: now() }, false, true);
          }
          saved = { ...reconciled, at: now() };
          return result(saved, false, saved.stale);
        }
        // An empty response is not a new observation or a reason to erase a
        // verified snapshot. Its original receipt time is never renewed.
        return saved ? result(saved, true, true) : result({ data, at: now() }, false, true);
      } catch (error) {
        if (saved) return result(saved, true, true);
        throw error;
      }
    })();
    try { return await pending; } finally { pending = undefined; }
  };
}
