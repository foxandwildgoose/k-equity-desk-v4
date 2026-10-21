import { parseFredCsv, type FredPoint } from "../lib/export-desk/parse-fred.ts";
import type { ExportProviderStatus } from "../lib/export-desk/provider-status.ts";

const SERIES = { exports: "XTEXVA01KRM667S", imports: "XTIMVA01KRM667S" } as const;
const FRESH_MS = 4 * 60 * 60 * 1_000;
const FAILURE_MS = 60 * 1_000;
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
const MAX_BODY_BYTES = 3_000_000;

export interface FredSeriesMetadata {
  units: string;
  frequency: "Monthly";
  seasonalAdjustment: "Not Seasonally Adjusted" | "Seasonally Adjusted";
}

export interface FredTradeResult {
  exports: FredPoint[];
  imports: FredPoint[];
  providers: ExportProviderStatus[];
  source: string;
}

type Fetch = typeof globalThis.fetch;
type SeriesResult = { points: FredPoint[]; metadata: FredSeriesMetadata | null; provider: ExportProviderStatus };
type CachedSeries = { points: FredPoint[]; metadata: FredSeriesMetadata; fetchedAt: number; checkedAt: string };

function cleanHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ")
    .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_match, hex: string, decimal: string) => {
      const code = Number.parseInt(hex ?? decimal, hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ").trim().replace(/[,;]\s*$/, "");
}

function classText(html: string, className: string): string | null {
  // FRED publishes these named fields on its official series page. Do not
  // infer a currency/scale from a series code, title or the values' magnitude.
  const tags = /<([a-z][\w:-]*)\b([^>]*\bclass\s*=\s*(["'])(.*?)\3[^>]*)>/gi;
  for (const match of html.matchAll(tags)) {
    if (!match[4]!.split(/\s+/).includes(className)) continue;
    const contents = html.slice(match.index! + match[0].length);
    const closing = new RegExp(`</${match[1]}\\s*>`, "i").exec(contents);
    if (closing) return cleanHtml(contents.slice(0, closing.index));
  }
  return null;
}

function pageIdentifiesSeries(html: string, seriesId: string): boolean {
  const identities: boolean[] = [];
  for (const match of html.matchAll(/<(?:meta|link)\b[^>]*>/gi)) {
    const attrs: Record<string, string> = {};
    for (const attr of match[0].matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)) attrs[attr[1]!.toLowerCase()] = cleanHtml(attr[3]!);
    const target = attrs.property === "og:url" ? attrs.content : attrs.rel === "canonical" ? attrs.href : null;
    if (!target) continue;
    try {
      const url = new URL(target);
      identities.push(url.origin === "https://fred.stlouisfed.org" && url.pathname === `/series/${seriesId}`);
    } catch { identities.push(false); }
  }
  if (identities.length) return identities.every(Boolean);
  const title = cleanHtml(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  return title.includes(`(${seriesId})`) && /\bFRED\b/.test(title);
}

/** The official page must identify the requested series and its scale. */
export function parseFredSeriesMetadata(html: string, seriesId: string): FredSeriesMetadata | null {
  if (html.length > MAX_BODY_BYTES || !/^[A-Z][A-Z0-9]+$/.test(seriesId) || !pageIdentifiesSeries(html, seriesId)) return null;
  const units = classText(html, "series-meta-value-units");
  const frequency = classText(html, "series-meta-value-frequency");
  const seasonalAdjustment = classText(html, "series-meta-value-seasonal");
  if (!units || frequency !== "Monthly" || (seasonalAdjustment !== "Not Seasonally Adjusted" && seasonalAdjustment !== "Seasonally Adjusted")) return null;
  // Delegate the supported USD scale list to the CSV parser so metadata and
  // data cannot disagree. Unknown units, won and indices are not USD totals.
  const probe = parseFredCsv(`DATE,${seriesId}\n2000-01-01,1\n`, seriesId, { units, frequency });
  if (probe.length !== 1) return null;
  return { units, frequency, seasonalAdjustment };
}

class FredFailure extends Error {
  readonly reason: string;
  readonly state: ExportProviderStatus["state"];
  constructor(reason: string, state: ExportProviderStatus["state"] = "unavailable") { super(reason); this.reason = reason; this.state = state; }
}

function koreanMonth(now: Date): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1_000).toISOString().slice(0, 7);
}

function oldLatestPeriod(period: string | null, now: Date): boolean {
  if (!period) return true;
  const [year, month] = koreanMonth(now).split("-").map(Number);
  const cutoff = new Date(Date.UTC(year!, month! - 5, 1)).toISOString().slice(0, 7);
  return period < cutoff;
}

/** No credential or transport error text is returned to the browser. */
export function createFredTradeClient(options: { fetch?: Fetch; now?: () => Date; timeoutMs?: number } = {}) {
  const fetcher = options.fetch ?? globalThis.fetch;
  const now = options.now ?? (() => new Date());
  const timeoutMs = options.timeoutMs ?? 8_000;
  const successes = new Map<string, CachedSeries>();
  const results = new Map<string, { until: number; result: SeriesResult }>();
  const pending = new Map<string, Promise<SeriesResult>>();

  async function fetchText(url: string, maximumBytes = MAX_BODY_BYTES, group?: AbortSignal): Promise<string> {
    const abort = new AbortController();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let rejectDeadline: (reason: FredFailure) => void = () => {};
    const stopReader = () => { void reader?.cancel().catch(() => {}); };
    abort.signal.addEventListener("abort", stopReader, { once: true });
    const timeout = new Promise<never>((_resolve, reject) => {
      rejectDeadline = reject;
      timer = setTimeout(() => { abort.abort(); reject(new FredFailure("REQUEST_TIMEOUT")); }, timeoutMs);
    });
    const stopGroup = () => { abort.abort(); rejectDeadline(new FredFailure("REQUEST_CANCELLED")); };
    group?.addEventListener("abort", stopGroup, { once: true });
    if (group?.aborted) stopGroup();
    const request = (async () => {
      const response = await fetcher(url, { signal: abort.signal, headers: { Accept: url.includes("fredgraph.csv") ? "text/csv" : "text/html", "User-Agent": "KoreaExportDesk/2.0" } });
      if (!response.ok) throw new FredFailure(response.status === 429 ? "RATE_LIMIT" : `HTTP_${response.status}`, response.status === 429 ? "rate-limited" : "unavailable");
      if (response.url) {
        const final = new URL(response.url);
        if (final.origin !== "https://fred.stlouisfed.org" || final.pathname !== new URL(url).pathname) throw new FredFailure("UNEXPECTED_REDIRECT", "unverified");
      }
      const declaredLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) throw new FredFailure("BODY_LIMIT", "unverified");
      if (!response.body) return "";
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let bytes = 0, output = "";
      while (!abort.signal.aborted) {
        const chunk = await reader.read();
        if (abort.signal.aborted) throw new FredFailure("REQUEST_TIMEOUT");
        if (chunk.done) return output + decoder.decode();
        bytes += chunk.value.byteLength;
        if (bytes > maximumBytes) throw new FredFailure("BODY_LIMIT", "unverified");
        output += decoder.decode(chunk.value, { stream: true });
      }
      throw new FredFailure("REQUEST_TIMEOUT");
    })();
    try { return await Promise.race([request, timeout]); }
    catch (error) { throw error instanceof FredFailure ? error : new FredFailure("TRANSPORT_ERROR"); }
    finally {
      if (timer) clearTimeout(timer);
      abort.abort();
      abort.signal.removeEventListener("abort", stopReader);
      group?.removeEventListener("abort", stopGroup);
    }
  }

  function status(kind: keyof typeof SERIES, points: FredPoint[], checkedAt: string, state: ExportProviderStatus["state"], message: string, reasonCode?: string): ExportProviderStatus {
    return {
      id: `fred.${kind}`, name: `FRED/OECD 한국 ${kind === "exports" ? "수출" : "수입"}`,
      configured: true, state, message, checkedAt, asOf: points.at(-1)?.period ?? null, recordCount: points.length,
      sourceUrl: `https://fred.stlouisfed.org/series/${SERIES[kind]}`, ...(reasonCode ? { reasonCode } : {}),
    };
  }

  async function load(kind: keyof typeof SERIES): Promise<SeriesResult> {
    const id = SERIES[kind], checked = now(), checkedAt = checked.toISOString();
    const cachedResult = results.get(id);
    if (cachedResult && checked.getTime() < cachedResult.until) return cachedResult.result;
    const inflight = pending.get(id);
    if (inflight) return inflight;
    const task = (async (): Promise<SeriesResult> => {
      const requestGroup = new AbortController();
      try {
        const startYear = checked.getUTCFullYear() - 12;
        const [html, csv] = await Promise.all([
          fetchText(`https://fred.stlouisfed.org/series/${id}`, MAX_BODY_BYTES, requestGroup.signal),
          fetchText(`https://fred.stlouisfed.org/graph/fredgraph.csv?${new URLSearchParams({ id, cosd: `${startYear}-01-01` })}`, MAX_BODY_BYTES, requestGroup.signal),
        ]);
        const metadata = parseFredSeriesMetadata(html, id);
        if (!metadata) throw new FredFailure("METADATA_UNVERIFIED", "unverified");
        const points = parseFredCsv(csv, id, metadata).filter(point => point.period < koreanMonth(checked));
        if (!points.length) throw new FredFailure("NO_VERIFIED_MONTHS", "empty");
        const stale = oldLatestPeriod(points.at(-1)?.period ?? null, checked);
        const result: SeriesResult = {
          points, metadata,
          provider: status(kind, points, checkedAt, stale ? "stale" : "ok", `${metadata.units} → USD · Monthly · ${metadata.seasonalAdjustment}${stale ? " · 최근 공표 월 시차 확인 필요" : ""}`),
        };
        successes.set(id, { points, metadata, fetchedAt: checked.getTime(), checkedAt });
        results.set(id, { until: checked.getTime() + FRESH_MS, result });
        return result;
      } catch (error) {
        const failure = error instanceof FredFailure ? error : new FredFailure("TRANSPORT_ERROR");
        const cached = successes.get(id);
        const usable = cached && checked.getTime() - cached.fetchedAt <= MAX_CACHE_AGE_MS;
        const points = usable ? cached.points : [];
        const result: SeriesResult = {
          points, metadata: usable ? cached.metadata : null,
          provider: status(kind, points, checkedAt, usable ? "stale" : failure.state, usable
            ? `공식 데이터 재조회 실패 · ${cached.checkedAt} 검증본 · 최신 공표값과 다를 수 있습니다.`
            : failure.state === "unverified" ? "공식 메타데이터·단위 검증 실패. 확인되지 않은 수치를 사용하지 않습니다."
            : failure.state === "rate-limited" ? "FRED 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요."
            : failure.state === "empty" ? "검증된 완료 월 데이터가 없습니다."
            : "FRED 공식 통계 조회에 실패했습니다. 다른 정상 데이터는 계속 사용할 수 있습니다.", failure.reason),
        };
        results.set(id, { until: checked.getTime() + FAILURE_MS, result });
        return result;
      } finally { requestGroup.abort(); }
    })();
    pending.set(id, task);
    try { return await task; } finally { pending.delete(id); }
  }

  return {
    async fetchFredTrade(): Promise<FredTradeResult> {
      const [exp, imp] = await Promise.all([load("exports"), load("imports")]);
      // A trade balance cannot subtract an SA series from an NSA series. Keep
      // usable exports, but withhold imports until their basis is consistent.
      const mismatchedBasis = exp.points.length > 0 && imp.points.length > 0 && exp.metadata && imp.metadata &&
        exp.metadata.seasonalAdjustment !== imp.metadata.seasonalAdjustment;
      const importProvider: ExportProviderStatus = mismatchedBasis ? {
        ...imp.provider, state: "unverified", reasonCode: "SEASONAL_BASIS_MISMATCH", asOf: null, recordCount: 0,
        message: "수출·수입의 계절조정 기준이 달라 수입과 무역수지 계산에서 제외합니다. 수출 원자료는 유지합니다.",
      } : imp.provider;
      const descriptions = ([exp, imp] as const).map((result, index) => result.metadata && !(index === 1 && mismatchedBasis) ? `${index === 0 ? SERIES.exports : SERIES.imports}: ${result.metadata.units}, ${result.metadata.seasonalAdjustment}` : "").filter(Boolean);
      return { exports: exp.points, imports: mismatchedBasis ? [] : imp.points, providers: [exp.provider, importProvider], source: descriptions.length ? `FRED/OECD · ${descriptions.join(" / ")}` : "FRED/OECD 공식 시계열 (조회 불가)" };
    },
  };
}

export const fetchFredTrade = createFredTradeClient().fetchFredTrade;
