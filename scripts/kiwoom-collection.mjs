import { isFlowDate } from "../src/lib/charts/hts-flow.ts";

const successful = job => job?.complete === true && ["ready", "history"].includes(job.status) &&
  job.invalidRows === 0 && !job.missingDates?.length;
const shiftDate = (date, days) => new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);

/** Cursor requests stay immutable. A completed historical range permits a
 * bounded refresh, while a wider historical request must backfill in full. */
export async function selectKiwoomCollection(store, identity, metric, { incremental = false, resume = false } = {}) {
  if (!incremental && !resume) return { identity, coverage: null };
  const [exact, latest, completed] = await Promise.all([
    store.job(identity, metric, true),
    store.job(identity, metric, false),
    store.completedCoverage?.(identity, metric) ?? null,
  ]);
  const coverage = successful(exact)
    ? { ...exact, requestedFrom: identity.request.from, requestedTo: identity.request.to }
    : successful(completed) && isFlowDate(completed.requestedFrom) && isFlowDate(completed.requestedTo) &&
      completed.requestedFrom <= identity.request.from && completed.requestedTo >= identity.request.from
      ? completed : null;
  if (resume && exact && !exact.complete) return { identity, coverage };
  if (resume && coverage && latest && !latest.complete && latest.nextKey &&
    isFlowDate(latest.requestedFrom) && latest.requestedFrom >= identity.request.from &&
    latest.requestedFrom <= shiftDate(coverage.requestedTo, 1) && latest.requestedTo === identity.request.to) {
    return { identity: { ...identity, request: { ...identity.request, from: latest.requestedFrom } }, coverage };
  }
  if (!incremental || !coverage) return { identity, coverage };
  const rows = await store.read(identity, metric);
  const last = rows.reduce((date, row) => row.value !== null && isFlowDate(row.date) && (!date || row.date > date) ? row.date : date, null);
  if (!last) return { identity, coverage };
  // A later partial/manual row must not skip the gap after certified history.
  const overlap = shiftDate(last, -14);
  const coveredOverlap = shiftDate(coverage.requestedTo, -14);
  const from = overlap < coveredOverlap ? overlap : coveredOverlap;
  return { identity: { ...identity, request: { ...identity.request, from: from > identity.request.from ? from : identity.request.from } }, coverage };
}

/** Extend the historical certificate only after overlapping refresh and a
 * separate full-range stored read. Provider-end history retains its status. */
export function completeKiwoomIncrementalJob(identity, collectionIdentity, coverage, job, rows) {
  if (!successful(coverage) || !successful(job) || job.invalidRows !== 0 ||
    !isFlowDate(coverage.requestedFrom) || !isFlowDate(coverage.requestedTo) ||
    coverage.requestedFrom > identity.request.from ||
    collectionIdentity.request.from > shiftDate(coverage.requestedTo, 1) ||
    collectionIdentity.request.to !== identity.request.to || job.missingDates?.length) return null;
  const validDates = new Set(rows.filter(row => row.value !== null).map(row => row.date));
  if (!validDates.size) return null;
  const missingDates = identity.request.expectedDailyDates?.filter(date =>
    date >= identity.request.from && date <= identity.request.to && !validDates.has(date)) ?? null;
  if (missingDates?.length) return null;
  const extent = (a, b, oldest) => !a ? b : !b ? a : oldest ? a < b ? a : b : a > b ? a : b;
  return { ...job,
    status: coverage.status === "history" ? "history" : job.status,
    stopReason: coverage.status === "history" ? coverage.stopReason ?? job.stopReason : job.stopReason,
    oldestDate: extent(coverage.oldestDate, job.oldestDate, true),
    newestDate: extent(coverage.newestDate, job.newestDate, false),
    missingDates,
    calendarBasis: identity.request.expectedDailyDates?.length ? "observed-price-sessions" : "unknown",
  };
}
