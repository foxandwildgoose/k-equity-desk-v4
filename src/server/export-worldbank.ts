/** Server-only World Bank GEM monthly merchandise trade. No credential is required. */
import type { FredPoint } from "../lib/export-desk/parse-fred.ts";
import type { ExportProviderStatus } from "../lib/export-desk/provider-status.ts";

type Kind = "exports" | "imports";
type Row = Record<string, unknown>;
type ProviderState = ExportProviderStatus["state"];
interface Window {
  start: string;
  end: string;
  months: number;
}
interface Metadata {
  id: string;
  unit: "USD million";
  seasonalAdjustment: "NSA";
}
interface SeriesResult {
  points: FredPoint[];
  provider: ExportProviderStatus;
}
interface CountryMetadata {
  id: string;
  iso2: string;
  name: string;
}
interface Success {
  points: FredPoint[];
  fetchedAt: number;
  checkedAt: string;
}
interface Envelope {
  rows: Row[];
  page: number;
  pages: number;
  size: number;
  total: number;
}

export interface WorldBankTradeOptions {
  months?: number;
}
export interface WorldBankTradeResult {
  exports: FredPoint[];
  imports: FredPoint[];
  providers: ExportProviderStatus[];
  source: string;
}
export const WORLD_BANK_TRADE_SERIES = {
  exports: "DXGSRMRCHNSCD",
  imports: "DMGSRMRCHNSCD",
} as const;
const ORIGIN = "https://api.worldbank.org";
const SOURCE_ID = "15";
const SOURCE = "World Bank GEM · 한국 월별 상품무역 · 수출 FOB / 수입 CIF · 경상 USD · 계절조정 전";
const MAX_BYTES = 3_000_000;
const MAX_PAGES = 4;
const PAGE_SIZE = 1000;
const CACHE_LIMIT = 32;
const FRESH_MS = 4 * 60 * 60_000;
const FAILURE_MS = 60_000;
const MAX_STALE_MS = 7 * 24 * 60 * 60_000;

// Source 15's NSA, current-USD-million series are separate from its SACD series.
// Catalog evidence (official API metadata is still checked on every cache refresh):
// https://github.com/jpazvd/wb-api-repo/blob/ca790d3d80d53cc33c6cb70d351863c7c476ac7b/src/w/wbopendata_sourceid_indicators15.sthlp
// Monthly frequency is selected by date=YYYYMmm:YYYYMmm, not frequency=M:
// https://github.com/laurentflorin/global_koma/blob/2207916bf18ba005a4ac1bc73040b35316fe259e/R/data_worldbank.R

class WorldBankFailure extends Error {
  readonly reason: string;
  readonly state: ProviderState;
  constructor(reason: string, state: ProviderState = "unverified") {
    super("World Bank 공식 통계 응답을 검증하지 못했습니다.");
    this.reason = reason;
    this.state = state;
  }
}
const row = (value: unknown): Row | null =>
  value != null && typeof value === "object" && !Array.isArray(value) ? (value as Row) : null;
const text = (value: unknown): string =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
const words = (value: unknown): string =>
  text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
function integer(value: unknown): number | null {
  const raw = text(value);
  return /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : null;
}
function prune<T>(map: Map<string, T>) {
  while (map.size > CACHE_LIMIT) map.delete(map.keys().next().value!);
}
function monthWindow(date: Date, months: number): Window {
  const korean = new Date(date.getTime() + 9 * 60 * 60_000);
  const start = new Date(Date.UTC(korean.getUTCFullYear(), korean.getUTCMonth() - months, 1));
  const end = new Date(Date.UTC(korean.getUTCFullYear(), korean.getUTCMonth() - 1, 1));
  return { start: start.toISOString().slice(0, 7), end: end.toISOString().slice(0, 7), months };
}
function usdMillionUnit(value: unknown): boolean {
  const normalized = words(value);
  return (
    /^(?:currentusmillions|usmillions|millionus|millionsus|usdmillions?|millions?usd|millionsof(?:current)?(?:us|unitedstates)dollars)$/.test(
      normalized,
    ) || normalized.match(CURRENT_USD_MILLIONS)?.[0] === normalized
  );
}
// These phrases express the same documented unit, regardless of punctuation or
// whether "millions" precedes the currency. Do not infer scale from magnitudes.
const CURRENT_USD_MILLIONS =
  /(?:current(?:unitedstatesdollars|usdollars|usd|us)millions?|millions?ofcurrent(?:unitedstatesdollars|usdollars|usd|us))/;
function currentUsdMillions(value: unknown): boolean {
  const normalized = words(value);
  return CURRENT_USD_MILLIONS.test(normalized) && !/billions?|thousands?|constant/.test(normalized);
}
function envelope(value: unknown, expectedPage: number, metadata = false): Envelope {
  if (!Array.isArray(value) || value.length !== 2 || !Array.isArray(value[1]))
    throw new WorldBankFailure("RESPONSE_SCHEMA");
  const header = row(value[0]);
  if (!header) throw new WorldBankFailure("RESPONSE_SCHEMA");
  if (!metadata && text(header.sourceid) !== SOURCE_ID)
    throw new WorldBankFailure("SOURCE_MISMATCH");
  const page = integer(header.page),
    pages = integer(header.pages),
    size = integer(header.per_page),
    total = integer(header.total);
  if (
    page !== expectedPage ||
    pages == null ||
    size == null ||
    total == null ||
    size < 1 ||
    size > PAGE_SIZE ||
    pages > MAX_PAGES ||
    total > PAGE_SIZE * MAX_PAGES ||
    pages !== Math.max(1, Math.ceil(total / size))
  )
    throw new WorldBankFailure("PAGINATION_METADATA");
  if (value[1].length > size || value[1].some((item: unknown) => !row(item)))
    throw new WorldBankFailure("INVALID_ROWS");
  return { rows: value[1] as Row[], page, pages, size, total };
}
function parseMetadata(value: unknown, kind: Kind): Metadata {
  const parsed = envelope(value, 1, true);
  if (parsed.pages !== 1 || parsed.total !== 1 || parsed.rows.length !== 1)
    throw new WorldBankFailure("METADATA_COUNT");
  const indicator = parsed.rows[0]!;
  const source = row(indicator.source);
  if (
    text(indicator.id) !== WORLD_BANK_TRADE_SERIES[kind] ||
    text(source?.id) !== SOURCE_ID ||
    !words(source?.value).startsWith("globaleconomicmonitor")
  )
    throw new WorldBankFailure("METADATA_IDENTITY");
  const name = words(indicator.name);
  const prefix = `${kind}merchandisecustoms`;
  if (!name.startsWith(prefix)) throw new WorldBankFailure("METADATA_NAME_MISMATCH");
  const note = words(indicator.sourceNote);
  const basis = kind === "exports" ? "freeonboard" : "costinsuranceandfreight";
  const titleUnit = name.slice(prefix.length);
  const titleMatch = titleUnit.match(CURRENT_USD_MILLIONS);
  if (
    !titleMatch ||
    titleMatch[0] !== titleUnit ||
    !currentUsdMillions(note) ||
    (text(indicator.unit) && !usdMillionUnit(indicator.unit))
  )
    throw new WorldBankFailure("USD_MILLION_UNITS_UNVERIFIED");
  if (
    !note.includes("notseasonallyadjusted") ||
    note.replaceAll("notseasonallyadjusted", "").includes("seasonallyadjusted")
  )
    throw new WorldBankFailure("SEASONAL_BASIS_UNVERIFIED");
  if (!note.includes(kind) || !note.includes(basis))
    throw new WorldBankFailure("VALUATION_BASIS_UNVERIFIED");
  return { id: WORLD_BANK_TRADE_SERIES[kind], unit: "USD million", seasonalAdjustment: "NSA" };
}
function parseCountryMetadata(value: unknown): CountryMetadata {
  const parsed = envelope(value, 1, true);
  const country = parsed.rows[0];
  if (
    parsed.pages !== 1 ||
    parsed.total !== 1 ||
    parsed.rows.length !== 1 ||
    text(country?.id) !== "KOR" ||
    text(country?.iso2Code) !== "KR" ||
    words(country?.name) !== "korearep"
  )
    throw new WorldBankFailure("COUNTRY_METADATA_IDENTITY");
  return { id: text(country!.id), iso2: text(country!.iso2Code), name: text(country!.name) };
}
function parseRows(
  rows: Row[],
  kind: Kind,
  range: Window,
  countryMetadata: CountryMetadata,
): FredPoint[] {
  const values = new Map<string, number>();
  const seen = new Set<string>();
  for (const item of rows) {
    if (text(row(item.indicator)?.id) !== WORLD_BANK_TRADE_SERIES[kind])
      throw new WorldBankFailure("DATA_INDICATOR_IDENTITY");
    const iso3 = text(item.countryiso3code);
    if (
      (item.countryiso3code != null && typeof item.countryiso3code !== "string") ||
      (iso3 && iso3 !== countryMetadata.id)
    )
      throw new WorldBankFailure("DATA_COUNTRY_ISO3");
    const country = row(item.country);
    if (![countryMetadata.id, countryMetadata.iso2].includes(text(country?.id)))
      throw new WorldBankFailure("DATA_COUNTRY_IDENTITY");
    // Missing GEM ISO3 fields require both the ID and entity label verified by
    // the separate official country metadata response, never a guessed alias.
    if (!iso3 && words(country?.value) !== words(countryMetadata.name))
      throw new WorldBankFailure("DATA_COUNTRY_NAME");
    const match = text(item.date).match(/^(\d{4})M(0[1-9]|1[0-2])$/);
    if (!match) throw new WorldBankFailure("NON_MONTHLY_OBSERVATION");
    const period = `${match[1]}-${match[2]}`;
    if (period < range.start || period > range.end) throw new WorldBankFailure("PERIOD_MISMATCH");
    if (seen.has(period)) throw new WorldBankFailure("DUPLICATE_OBSERVATION");
    seen.add(period);
    if (text(item.unit) && !usdMillionUnit(item.unit))
      throw new WorldBankFailure("OBSERVATION_UNITS");
    if (text(item.obs_status)) throw new WorldBankFailure("OBSERVATION_STATUS_UNVERIFIED");
    if (item.value === null) continue;
    if (
      typeof item.value !== "number" ||
      !Number.isFinite(item.value) ||
      item.value < 0 ||
      item.value * 1_000_000 > Number.MAX_SAFE_INTEGER
    )
      throw new WorldBankFailure("INVALID_USD_VALUE");
    values.set(period, item.value * 1_000_000);
  }
  return [...values]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, valueUsd]) => ({ period, valueUsd }));
}

export function createWorldBankTradeClient(
  options: {
    fetch?: typeof globalThis.fetch;
    now?: () => Date;
    timeoutMs?: number;
    budgetMs?: number;
  } = {},
) {
  const fetcher = options.fetch ?? globalThis.fetch;
  const now = options.now ?? (() => new Date());
  const timeoutMs = Math.max(10, Math.min(10_000, options.timeoutMs ?? 8_000));
  // Metadata and every data page share one deadline, so pagination cannot
  // outlive the refresh lease even when a transport ignores AbortSignal.
  const budgetMs = Math.max(10, Math.min(18_000, options.budgetMs ?? 18_000));
  const metadata = new Map<Kind, { until: number; value: Metadata }>();
  const metadataPending = new Map<Kind, Promise<Metadata>>();
  let countryMetadata: { until: number; value: CountryMetadata } | undefined;
  let countryPending: Promise<CountryMetadata> | undefined;
  const successes = new Map<string, Success>();
  const results = new Map<string, { until: number; value: SeriesResult }>();
  const pending = new Map<string, Promise<SeriesResult>>();

  async function getJson(url: URL, group: AbortSignal): Promise<unknown> {
    const abort = new AbortController();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let rejectStopped: (reason: WorldBankFailure) => void = () => {};
    const deadline = new Promise<never>((_resolve, reject) => {
      rejectStopped = reject;
      timer = setTimeout(() => {
        abort.abort();
        void reader?.cancel().catch(() => {});
        reject(new WorldBankFailure("REQUEST_TIMEOUT", "unavailable"));
      }, timeoutMs);
    });
    const stopGroup = () => {
      abort.abort();
      void reader?.cancel().catch(() => {});
      rejectStopped(new WorldBankFailure("SERIES_TIMEOUT", "unavailable"));
    };
    group.addEventListener("abort", stopGroup, { once: true });
    if (group.aborted) stopGroup();
    const work = (async () => {
      if (abort.signal.aborted) throw new WorldBankFailure("SERIES_TIMEOUT", "unavailable");
      const response = await fetcher(url, {
        signal: abort.signal,
        redirect: "error",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (abort.signal.aborted) throw new WorldBankFailure("REQUEST_TIMEOUT", "unavailable");
      if (!response.ok)
        throw new WorldBankFailure(
          response.status === 429 ? "RATE_LIMIT" : `HTTP_${response.status}`,
          response.status === 429 ? "rate-limited" : "unavailable",
        );
      if (response.url) {
        const final = new URL(response.url);
        if (final.origin !== ORIGIN || final.pathname !== url.pathname)
          throw new WorldBankFailure("UNEXPECTED_REDIRECT");
      }
      const length = response.headers.get("content-length");
      if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES))
        throw new WorldBankFailure("BODY_LIMIT");
      if (!response.body) throw new WorldBankFailure("EMPTY_BODY");
      reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8", { fatal: true });
      let body = "",
        bytes = 0;
      for (;;) {
        const chunk = await reader.read();
        if (abort.signal.aborted) throw new WorldBankFailure("REQUEST_TIMEOUT", "unavailable");
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > MAX_BYTES) throw new WorldBankFailure("BODY_LIMIT");
        body += decoder.decode(chunk.value, { stream: true });
      }
      return JSON.parse(body + decoder.decode()) as unknown;
    })();
    try {
      return await Promise.race([work, deadline]);
    } catch (error) {
      throw error instanceof WorldBankFailure
        ? error
        : new WorldBankFailure("TRANSPORT_OR_JSON_ERROR", "unavailable");
    } finally {
      if (timer) clearTimeout(timer);
      abort.abort();
      void reader?.cancel().catch(() => {});
      group.removeEventListener("abort", stopGroup);
    }
  }
  function metadataUrl(kind: Kind): URL {
    const url = new URL(`/v2/indicator/${WORLD_BANK_TRADE_SERIES[kind]}`, ORIGIN);
    url.search = new URLSearchParams({
      source: SOURCE_ID,
      format: "json",
      per_page: String(PAGE_SIZE),
      page: "1",
    }).toString();
    return url;
  }
  async function loadMetadata(kind: Kind, group: AbortSignal): Promise<Metadata> {
    const cached = metadata.get(kind);
    if (cached && cached.until > now().getTime()) return cached.value;
    const inflight = metadataPending.get(kind);
    if (inflight) return inflight;
    const task = (async () => {
      const value = parseMetadata(await getJson(metadataUrl(kind), group), kind);
      metadata.set(kind, { until: now().getTime() + FRESH_MS, value });
      return value;
    })();
    metadataPending.set(kind, task);
    try {
      return await task;
    } finally {
      metadataPending.delete(kind);
    }
  }
  async function loadCountryMetadata(group: AbortSignal): Promise<CountryMetadata> {
    if (countryMetadata && countryMetadata.until > now().getTime()) return countryMetadata.value;
    if (countryPending) return countryPending;
    const task = (async () => {
      const url = new URL("/v2/country/KOR", ORIGIN);
      url.search = new URLSearchParams({
        format: "json",
        per_page: String(PAGE_SIZE),
        page: "1",
      }).toString();
      const value = parseCountryMetadata(await getJson(url, group));
      countryMetadata = { until: now().getTime() + FRESH_MS, value };
      return value;
    })();
    countryPending = task;
    try {
      return await task;
    } finally {
      countryPending = undefined;
    }
  }
  async function loadData(
    kind: Kind,
    range: Window,
    group: AbortSignal,
    country: CountryMetadata,
  ): Promise<FredPoint[]> {
    const rows: Row[] = [];
    let first: Envelope | undefined;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = new URL(`/v2/country/KOR/indicator/${WORLD_BANK_TRADE_SERIES[kind]}`, ORIGIN);
      url.search = new URLSearchParams({
        source: SOURCE_ID,
        format: "json",
        per_page: String(PAGE_SIZE),
        page: String(page),
        date: `${range.start.replace("-", "M")}:${range.end.replace("-", "M")}`,
      }).toString();
      const parsed = envelope(await getJson(url, group), page);
      first ??= parsed;
      if (
        parsed.total !== first.total ||
        parsed.pages !== first.pages ||
        parsed.size !== first.size ||
        parsed.total > range.months
      )
        throw new WorldBankFailure("PAGINATION_CHANGED");
      rows.push(...parsed.rows);
      if (rows.length > parsed.total) throw new WorldBankFailure("COUNT_MISMATCH");
      if (page === parsed.pages) {
        if (rows.length !== parsed.total) throw new WorldBankFailure("TRUNCATED_RESPONSE");
        return parseRows(rows, kind, range, country);
      }
      if (parsed.rows.length !== parsed.size) throw new WorldBankFailure("TRUNCATED_RESPONSE");
    }
    throw new WorldBankFailure("PAGE_LIMIT");
  }
  function provider(
    kind: Kind,
    points: FredPoint[],
    checked: Date,
    state: ProviderState,
    reasonCode?: string,
    cacheCheckedAt?: string,
  ): ExportProviderStatus {
    const messages: Partial<Record<ProviderState, string>> = {
      ok: "공식 GEM 메타데이터와 월별 자료 검증 완료 · 백만 USD → USD · 계절조정 전",
      partial: "검증된 월만 표시합니다. 요청 기간 중 일부 월은 공표되지 않았거나 자료가 없습니다.",
      stale: cacheCheckedAt
        ? `재조회 실패 · ${cacheCheckedAt} 검증본 · 최신 공표값과 다를 수 있습니다.`
        : "공식 자료의 최근 공표 월에 시차가 있어 기준월을 확인해야 합니다.",
      empty: "요청한 완료 월에 검증된 World Bank 상품무역 자료가 없습니다.",
      unverified: "공식 메타데이터·단위·국가·월별 기준을 검증하지 못해 수치를 사용하지 않습니다.",
      "rate-limited": "World Bank API 요청 한도에 도달했습니다. 잠시 후 다시 조회합니다.",
      unavailable:
        "World Bank 공식 API 조회에 실패했습니다. 확인되지 않은 수치를 사용하지 않습니다.",
    };
    return {
      id: `worldbank-${kind}`,
      name: `World Bank GEM 한국 ${kind === "exports" ? "수출" : "수입"}`,
      configured: true,
      state,
      message: messages[state] ?? messages.unavailable!,
      checkedAt: checked.toISOString(),
      asOf: points.at(-1)?.period ?? null,
      recordCount: points.length,
      sourceUrl: metadataUrl(kind).href,
      ...(reasonCode ? { reasonCode } : {}),
    };
  }
  async function load(kind: Kind, range: Window): Promise<SeriesResult> {
    const key = `${kind}:${range.start}:${range.end}`;
    const checked = now();
    const cached = results.get(key);
    if (cached && cached.until > checked.getTime()) return cached.value;
    if (pending.has(key)) return pending.get(key)!;
    if (pending.size >= CACHE_LIMIT)
      return {
        points: [],
        provider: provider(kind, [], checked, "unavailable", "CONCURRENT_REQUEST_LIMIT"),
      };
    const task = (async (): Promise<SeriesResult> => {
      let value: SeriesResult;
      let successful = false;
      const group = new AbortController();
      const groupTimer = setTimeout(() => group.abort(), budgetMs);
      try {
        await loadMetadata(kind, group.signal);
        const country = await loadCountryMetadata(group.signal);
        const points = await loadData(kind, range, group.signal, country);
        successful = true;
        const staleCutoff = monthWindow(checked, 4).start;
        const state: ProviderState = !points.length
          ? "empty"
          : points.at(-1)!.period < staleCutoff
            ? "stale"
            : points.length < range.months
              ? "partial"
              : "ok";
        value = {
          points,
          provider: provider(
            kind,
            points,
            checked,
            state,
            !points.length
              ? "NO_VERIFIED_MONTHS"
              : state === "partial"
                ? "INCOMPLETE_MONTHS"
                : state === "stale"
                  ? "PUBLICATION_LAG"
                  : "API_OK",
          ),
        };
        if (points.length) {
          successes.set(key, {
            points,
            fetchedAt: checked.getTime(),
            checkedAt: checked.toISOString(),
          });
          prune(successes);
        }
      } catch (error) {
        const failed =
          error instanceof WorldBankFailure
            ? error
            : new WorldBankFailure("TRANSPORT_OR_JSON_ERROR", "unavailable");
        const old = successes.get(key);
        const usable =
          old &&
          checked.getTime() >= old.fetchedAt &&
          checked.getTime() - old.fetchedAt <= MAX_STALE_MS;
        const points = usable ? old.points : [];
        value = {
          points,
          provider: provider(
            kind,
            points,
            checked,
            usable ? "stale" : failed.state,
            failed.reason,
            usable ? old.checkedAt : undefined,
          ),
        };
      } finally {
        clearTimeout(groupTimer);
        group.abort();
      }
      results.set(key, {
        value,
        until: checked.getTime() + (successful && value.points.length ? FRESH_MS : FAILURE_MS),
      });
      prune(results);
      return value;
    })();
    pending.set(key, task);
    try {
      return await task;
    } finally {
      pending.delete(key);
    }
  }
  return {
    async fetchWorldBankTrade(options: WorldBankTradeOptions = {}): Promise<WorldBankTradeResult> {
      const months = Math.max(
        1,
        Math.min(120, Math.trunc(Number.isFinite(options.months) ? options.months! : 120)),
      );
      const range = monthWindow(now(), months);
      const [exp, imp] = await Promise.all([load("exports", range), load("imports", range)]);
      return structuredClone({
        exports: exp.points,
        imports: imp.points,
        providers: [exp.provider, imp.provider],
        source: SOURCE,
      });
    },
  };
}

export const fetchWorldBankTrade = createWorldBankTradeClient().fetchWorldBankTrade;
