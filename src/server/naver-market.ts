import { htmlToReadableText } from "@/lib/readable-text";
/**
 * Live Korean market data adapters (Naver Finance + Yahoo Finance + DART).
 * Quotes/indices: KRX via Naver realtime (exchange feed). Charts: Yahoo + Naver day fallback.
 * Server-only — called from createServerFn handlers. No synthetic prices.
 */
import { UNIVERSE, type UniverseItem } from "@/data/universe";
import { detectKrMarket, normalizeKrTicker, isKrTicker, inferSectorId } from "@/lib/infer-sector";
import { yahooUsSymbol } from "@/lib/valuation-series";
import { classifyResearchSectors } from "@/data/research-taxonomy";
import { buildResearchExecutiveSummary } from "@/lib/research-utils";
import { sortReportsNewestFirst } from "@/lib/feed/mappers";
import { chartVolume } from "@/lib/charts/volume-validity";

const UA =
  "Mozilla/5.0 (compatible; KoreaEquityCommand/1.0; +https://x.ai) AppleWebKit/537.36";

function headers(extra?: Record<string, string>): HeadersInit {
  return {
    "User-Agent": UA,
    Accept: "application/json,text/plain,*/*",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    Referer: "https://m.stock.naver.com/",
    ...extra,
  };
}

async function getText(url: string, init?: RequestInit): Promise<string> {
  const ctrl = new AbortController();
  // Fail-fast: slow Naver legs must not stall the whole desk for 25s
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, {
      ...init,
      headers: { ...headers(), ...(init?.headers as object) },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function getJson<T>(url: string): Promise<T> {
  return JSON.parse(await getText(url)) as T;
}

async function getEucKr(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const res = await fetch(url, {
      headers: headers({ Referer: "https://finance.naver.com/" }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    try {
      return new TextDecoder("euc-kr").decode(buf);
    } catch {
      return buf.toString("utf8");
    }
  } finally {
    clearTimeout(timer);
  }
}

export interface LiveQuote {
  code: string;
  nameKo: string;
  nameEn: string;
  sectorId: UniverseItem["sectorId"];
  market: UniverseItem["market"];
  price: number;
  change: number;
  changePct: number;
  volume: number;
  marketCap: number;
  high52: number;
  low52: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  afterHoursPrice?: number;
  afterHoursChange?: number;
  afterHoursChangePct?: number;
  marketStatus: string;
  tradedAt?: string;
  source: "naver-finance-snapshot" | "kis-krx-websocket";
}

export interface OhlcBar {
  date: string;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** False means missing/invalid provider volume; numeric zero is a JSON carrier only. */
  volumeValid?: boolean;
  bullish: boolean;
  ma5?: number;
  ma20?: number;
  ma60?: number;
  ma120?: number;
}

export interface FlowDay {
  date: string;
  label: string;
  individual: number;
  institution: number;
  foreign: number;
  close: number;
  foreignHoldRatio?: number;
}

export type ResearchCategory = "company" | "industry" | "market" | "economy";

export interface ResearchReport {
  researchId: number;
  code?: string;
  nameKo?: string;
  title: string;
  broker: string;
  date: string;
  preview: string;
  rating?: string;
  targetPrice?: number;
  category: ResearchCategory;
  categoryLabel: string;
  pdfUrl?: string;
  pageUrl: string;
  readCount?: number;
  /** Extractive summary generated only from the broker-provided preview/body. */
  summary: string;
  sectorIds: UniverseItem["sectorId"][];
  tags: string[];
  hasInvestmentView: boolean;
  /** Origin of the listing row */
  sourceKind?: "naver" | "hankyung";
  sourceLabel?: string;
  /** stock.naver.com research v2 type (company|industry|invest|economy|debenture|market). */
  v2Type?: "market" | "company" | "industry" | "invest" | "economy" | "debenture";
  /** Where the extractive summary came from. */
  summarySource?: "preview" | "detail" | "pdf-text" | "none";
  /** Only when an older same-broker/same-ticker report was actually fetched (F2.5). */
  prevTargetPrice?: number;
  prevRating?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  body: string;
  source: string;
  datetime: string;
  url: string;
}

export interface DisclosureItem {
  id: string;
  title: string;
  datetime: string;
  author: string;
  code: string;
  nameKo?: string;
  dartUrl?: string;
  dartSearchUrl: string;
  canLoadBody: boolean;
  source?: string;
  sourceLabel?: string;
  rcpNo?: string;
  market?: string;
}


export interface DisclosureDetail {
  id: string;
  code: string;
  title: string;
  datetime: string;
  author: string;
  html: string;
  text: string;
  rcpNo?: string;
  dartUrl?: string;
  dartSearchUrl: string;
}

export interface IndexQuote {
  id: string;
  nameKo: string;
  nameEn: string;
  value: number;
  change: number;
  changePct: number;
  marketStatus?: string;
  open?: number;
  high?: number;
  low?: number;
  source: string;
}

export type ChartInterval = "minute" | "day" | "week" | "month" | "year";
export type MinuteSize = 1 | 3 | 5 | 10 | 15 | 30 | 60;

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[+,]/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function parseSignedShares(v: string | number | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  return num(v);
}

function formatYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sma(closes: number[], end: number, period: number, round = true): number | undefined {
  if (end + 1 < period) return undefined;
  let sum = 0;
  for (let i = end - period + 1; i <= end; i++) sum += closes[i]!;
  const value = sum / period;
  return round ? Math.round(value) : value;
}

function withMas(
  bars: Omit<OhlcBar, "ma5" | "ma20" | "ma60" | "ma120">[],
  opts?: { round?: boolean },
): OhlcBar[] {
  const round = opts?.round !== false;
  const closes = bars.map((b) => b.close);
  return bars.map((bar, i) => ({
    ...bar,
    ma5: sma(closes, i, 5, round),
    ma20: sma(closes, i, 20, round),
    ma60: sma(closes, i, 60, round),
    ma120: sma(closes, i, 120, round),
  }));
}

function yahooSymbol(code: string, market: UniverseItem["market"]): string {
  return `${code}.${market === "KOSDAQ" ? "KQ" : "KS"}`;
}

function yahooSymbolCandidates(code: string, market: UniverseItem["market"]): string[] {
  const preferred = yahooSymbol(code, market);
  const alt = market === "KOSDAQ" ? `${code}.KS` : `${code}.KQ`;
  return [preferred, alt];
}

function dartSearchUrl(nameOrCode: string): string {
  return `https://dart.fss.or.kr/dsab001/main.do?autoSearch=Y&textCrpNm=${encodeURIComponent(nameOrCode)}`;
}

function dartViewerUrl(rcpNo: string): string {
  return `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rcpNo}`;
}

function extractRcpNo(html: string): string | undefined {
  const m =
    html.match(/rcpNo[=:](\d{14})/i) ||
    html.match(/rcpno[=:](\d{14})/i) ||
    html.match(/acptno[=:](\d{14})/i);
  return m?.[1];
}

function htmlToText(html: string): string {
  return htmlToReadableText(html);
}

function sanitizeDisclosureHtml(html: string, rcpNo?: string): string {
  let out = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
  out = out.replace(
    /https?:\/\/kind\.krx\.or\.kr[^"'\\\s>]*/gi,
    rcpNo ? dartViewerUrl(rcpNo) : "https://dart.fss.or.kr/",
  );
  return out;
}

/** Drop empty / placeholder ratings like "없음" */
function normalizeRating(raw: string | undefined | null): string | undefined {
  if (raw == null) return undefined;
  const u = raw.trim();
  if (!u || u === "-" || u === "—" || u === "없음" || u === "N/A" || u === "n/a") {
    return undefined;
  }
  const up = u.toUpperCase();
  if (up === "BUY" || u === "매수" || (u.includes("매수") && !u.includes("축소"))) {
    return u.includes("비중확대") ? "비중확대" : "매수";
  }
  if (up === "HOLD" || u === "중립" || u.includes("중립")) return "중립";
  if (up === "SELL" || u === "매도" || u.includes("매도")) return "매도";
  if (u.includes("비중확대") || up === "OUTPERFORM" || up === "OVERWEIGHT") {
    return "비중확대";
  }
  if (u.includes("비중축소") || up === "UNDERPERFORM" || up === "UNDERWEIGHT") {
    return "비중축소";
  }
  if (up.includes("TRADING")) return "단기매수";
  return u;
}

function extractTargetAndRating(text: string): {
  targetPrice?: number;
  rating?: string;
} {
  let targetPrice: number | undefined;
  let rating: string | undefined;

  for (const re of [
    /목표주가\s*([0-9]{1,3}(?:,[0-9]{3})+)\s*원/,
    /목표\s*주가\s*([0-9]{1,3}(?:,[0-9]{3})+)\s*원/,
    /목표주가\s*([0-9]{4,})\s*원/,
    /목표주가를?\s*([0-9]{1,3}(?:,[0-9]{3})+)\s*원/,
    /TP\s*([0-9]{1,3}(?:,[0-9]{3})+)\s*원/i,
    /목표주가\s*([0-9]{1,3}(?:,[0-9]{3})*)/,
  ]) {
    const m = text.match(re);
    if (m) {
      const n = num(m[1]);
      if (n >= 1000) {
        targetPrice = n;
        break;
      }
    }
  }

  for (const re of [
    /투자의견\s*[:：]?\s*(매수|중립|매도|비중확대|비중축소|Buy|Hold|Sell|BUY|HOLD|SELL|OUTPERFORM|UNDERPERFORM|OVERWEIGHT|UNDERWEIGHT)/i,
    /\[투자의견\][^\n]{0,60}(매수|중립|매도|비중확대|비중축소|BUY|HOLD|SELL)/i,
    /투자의견\s+(BUY|HOLD|SELL|매수|중립|매도)/i,
  ]) {
    const m = text.match(re);
    if (m) {
      rating = normalizeRating(m[1]);
      if (rating) break;
    }
  }

  return { targetPrice, rating };
}

// ── Quotes (Naver snapshot/fallback; KIS WebSocket is the primary live layer) ──

export async function fetchRealtimeQuotes(
  codes: string[],
  metaByCode?: Record<
    string,
    {
      nameKo: string;
      nameEn: string;
      sectorId: UniverseItem["sectorId"];
      market: UniverseItem["market"];
    }
  >,
): Promise<LiveQuote[]> {
  const unique = [
    ...new Set(
      codes.map((c) => normalizeKrTicker(c)).filter((c) => isKrTicker(c)),
    ),
  ];
  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += 40) {
    batches.push(unique.slice(i, i + 40));
  }

  type Row = {
    cd: string;
    nm?: string;
    nv: number | string;
    cv: number | string;
    cr: number | string;
    aq: number | string;
    ov?: number | string;
    hv?: number | string;
    lv?: number | string;
    pcv?: number | string;
    aa?: number | string;
    countOfListedStock?: number | string;
    highPriceOf52Weeks?: number | string;
    lowPriceOf52Weeks?: number | string;
    ms?: string;
    nxtOverMarketPriceInfo?: {
      overPrice?: string;
      compareToPreviousClosePrice?: string;
      fluctuationsRatio?: string | number;
    };
  };

  const rows: Row[] = [];
  // Parallel batches (4×40 for full universe) — sequential was ~3s cold
  const batchResults = await Promise.all(
    batches.map(async (batch) => {
      const url = `https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${batch.join(",")}`;
      try {
        const data = await getJson<{
          result?: { areas?: { datas?: Row[] }[] };
        }>(url);
        return data.result?.areas?.[0]?.datas ?? [];
      } catch {
        const fallback = await Promise.all(
          batch.map(async (code) => {
            try {
              const basic = await getJson<{
                stockName?: string;
                closePrice?: string;
                compareToPreviousClosePrice?: string;
                fluctuationsRatio?: string | number;
                accumulatedTradingVolume?: string;
                marketStatus?: string;
              }>(`https://m.stock.naver.com/api/stock/${code}/basic`);
              return {
                cd: code,
                nm: String(basic.stockName ?? ""),
                nv: num(String(basic.closePrice ?? "0").replace(/,/g, "")),
                cv: num(
                  String(basic.compareToPreviousClosePrice ?? "0").replace(
                    /,/g,
                    "",
                  ),
                ),
                cr: num(basic.fluctuationsRatio),
                aq: num(
                  String(basic.accumulatedTradingVolume ?? "0").replace(/,/g, ""),
                ),
                ms: String(basic.marketStatus ?? ""),
              } as Row;
            } catch {
              return null;
            }
          }),
        );
        return fallback.filter((x): x is Row => x != null);
      }
    }),
  );
  for (const part of batchResults) rows.push(...part);

  const out: LiveQuote[] = [];
  for (const r of rows) {
    const code = normalizeKrTicker(String(r.cd));
    const u = UNIVERSE.find((x) => x.code === code);
    const meta = metaByCode?.[code] ?? metaByCode?.[String(r.cd)];
    const price = num(r.nv);
    const listed = num(r.countOfListedStock);
    const marketCapEok =
      listed > 0
        ? Math.round((listed * price) / 1e8)
        : r.aa
          ? Math.round(num(r.aa) / 1e8)
          : 0;
    const ah = r.nxtOverMarketPriceInfo;
    out.push({
      code,
      nameKo: u?.nameKo ?? meta?.nameKo ?? r.nm ?? code,
      nameEn: u?.nameEn ?? meta?.nameEn ?? code,
      sectorId: u?.sectorId ?? meta?.sectorId ?? inferSectorId(u?.nameKo ?? meta?.nameKo ?? r.nm ?? code),
      market: u?.market ?? meta?.market ?? "KOSPI",
      price,
      change: num(r.cv),
      changePct: num(r.cr),
      volume: num(r.aq),
      marketCap: marketCapEok,
      high52: num(r.highPriceOf52Weeks),
      low52: num(r.lowPriceOf52Weeks),
      open: num(r.ov),
      high: num(r.hv),
      low: num(r.lv),
      prevClose: num(r.pcv),
      afterHoursPrice: ah?.overPrice
        ? num(ah.overPrice.replace(/,/g, ""))
        : undefined,
      afterHoursChange: ah?.compareToPreviousClosePrice
        ? num(ah.compareToPreviousClosePrice.replace(/,/g, ""))
        : undefined,
      afterHoursChangePct: ah?.fluctuationsRatio
        ? num(ah.fluctuationsRatio)
        : undefined,
      marketStatus: r.ms ?? "",
      source: "naver-finance-snapshot",
    });
  }
  return out;
}

export async function fetchAllUniverseQuotes(): Promise<LiveQuote[]> {
  return fetchRealtimeQuotes(UNIVERSE.map((u) => u.code));
}


/** Yahoo + optional Naver fchart for professional minute coverage. */
function yahooMinutePlan(
  minuteSize: MinuteSize,
  range?: string,
): { yahooInterval: string; range: string; bucket: number } {
  // Yahoo limits (approx): 1m≤7d, 2m/5m/15m/30m≤60d, 60m≤730d
  const size = minuteSize;
  if (size <= 1) {
    const allowed = new Set(["1d", "5d", "7d"]);
    return {
      yahooInterval: "1m",
      range: range && allowed.has(range) ? range : "7d",
      bucket: 1,
    };
  }
  if (size === 3) {
    // Always fetch 1m and clock-bucket to true 3m. (Yahoo has no 3m; never mislabel 2m as 3m.)
    // History hard-limit follows 1m (≤7d). Longer UI ranges clamp to 7d.
    const allowed = new Set(["1d", "5d", "7d"]);
    const rng = range && allowed.has(range) ? range : "7d";
    return { yahooInterval: "1m", range: rng, bucket: 3 };
  }
  if (size === 5) {
    const allowed = new Set(["1d", "5d", "1mo", "60d"]);
    return {
      yahooInterval: "5m",
      range: range && allowed.has(range) ? range : "60d",
      bucket: 1,
    };
  }
  if (size === 10) {
    const allowed = new Set(["1d", "5d", "1mo", "60d"]);
    return {
      yahooInterval: "5m",
      range: range && allowed.has(range) ? range : "60d",
      bucket: 2,
    };
  }
  if (size === 15) {
    const allowed = new Set(["1d", "5d", "1mo", "60d"]);
    return {
      yahooInterval: "15m",
      range: range && allowed.has(range) ? range : "60d",
      bucket: 1,
    };
  }
  if (size === 30) {
    const allowed = new Set(["5d", "1mo", "60d"]);
    return {
      yahooInterval: "30m",
      range: range && allowed.has(range) ? range : "60d",
      bucket: 1,
    };
  }
  // 60m — multi-month / multi-year
  const allowed = new Set(["1mo", "3mo", "6mo", "1y", "2y"]);
  return {
    yahooInterval: "60m",
    range: range && allowed.has(range) ? range : "1y",
    bucket: 1,
  };
}

function bucketMinuteBars(
  raw: Omit<OhlcBar, "ma5" | "ma20" | "ma60" | "ma120">[],
  size: number,
): Omit<OhlcBar, "ma5" | "ma20" | "ma60" | "ma120">[] {
  if (size <= 1) return raw;
  const buckets = new Map<string, typeof raw>();
  for (const bar of raw) {
    const [ymd, hm] = bar.date.split(" ");
    if (!ymd || !hm) continue;
    const [hh, mm] = hm.split(":").map(Number);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue;
    // total minutes from midnight, floor to size (keeps multi-hour buckets correct)
    const total = hh * 60 + mm;
    const floored = Math.floor(total / size) * size;
    const bh = Math.floor(floored / 60);
    const bm = floored % 60;
    const key = `${ymd} ${String(bh).padStart(2, "0")}:${String(bm).padStart(2, "0")}`;
    const list = buckets.get(key) ?? [];
    list.push(bar);
    buckets.set(key, list);
  }
  const grouped: typeof raw = [];
  for (const [key, chunk] of [...buckets.entries()].sort(([a], [b]) =>
    a.localeCompare(b), // ked-allow-string-date-sort: single-format time series
  )) {
    const first = chunk[0]!;
    const last = chunk[chunk.length - 1]!;
    grouped.push({
      date: key,
      label: key.slice(5), // MM-DD HH:mm
      open: first.open,
      high: Math.max(...chunk.map((x) => x.high)),
      low: Math.min(...chunk.map((x) => x.low)),
      close: last.close,
      volume: chunk.reduce((sum, x) => sum + x.volume, 0),
      volumeValid: chunk.every((x) => x.volumeValid !== false),
      bullish: last.close >= first.open,
    });
  }
  return grouped;
}

function parseYahooMinuteResult(result: {
  timestamp: number[];
  indicators: {
    quote: {
      open: (number | null)[];
      high: (number | null)[];
      low: (number | null)[];
      close: (number | null)[];
      volume: (number | null)[];
    }[];
  };
}): Omit<OhlcBar, "ma5" | "ma20" | "ma60" | "ma120">[] {
  const q = result.indicators.quote[0]!;
  const raw: Omit<OhlcBar, "ma5" | "ma20" | "ma60" | "ma120">[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const o = q.open[i];
    const h = q.high[i];
    const l = q.low[i];
    const c = q.close[i];
    const v = q.volume[i];
    if (o == null || h == null || l == null || c == null) continue;
    const kst = new Date(result.timestamp[i]! * 1000 + 9 * 3600 * 1000);
    const hh = String(kst.getUTCHours()).padStart(2, "0");
    const mm = String(kst.getUTCMinutes()).padStart(2, "0");
    const ymd = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
    raw.push({
      date: `${ymd} ${hh}:${mm}`,
      label: `${ymd.slice(5)} ${hh}:${mm}`,
      open: Math.round(o),
      high: Math.round(h),
      low: Math.round(l),
      close: Math.round(c),
      ...chartVolume(v),
      bullish: c >= o,
    });
  }
  return raw;
}

/** Naver fchart minute fallback (often close-only; reconstruct OHLC). */
async function fetchNaverMinuteFchart(
  code: string,
): Promise<Omit<OhlcBar, "ma5" | "ma20" | "ma60" | "ma120">[]> {
  try {
    const xml = await getText(
      `https://fchart.stock.naver.com/sise.nhn?symbol=${code}&timeframe=minute&count=5000&requestType=0`,
    );
    const items = [...xml.matchAll(/item data="([^"]+)"/g)].map((m) => m[1]!);
    const raw: Omit<OhlcBar, "ma5" | "ma20" | "ma60" | "ma120">[] = [];
    for (const row of items) {
      const [dt, o, h, l, c, v] = row.split("|");
      if (!dt || dt.length < 12) continue;
      const ymd = `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`;
      const hm = `${dt.slice(8, 10)}:${dt.slice(10, 12)}`;
      const close = num(c);
      if (!close) continue;
      const open = o && o !== "null" ? num(o) : close;
      const high = h && h !== "null" ? num(h) : close;
      const low = l && l !== "null" ? num(l) : close;
      raw.push({
        date: `${ymd} ${hm}`,
        label: `${ymd.slice(5)} ${hm}`,
        open,
        high: Math.max(high, open, close),
        low: Math.min(low, open, close),
        close,
        ...chartVolume(v),
        bullish: close >= open,
      });
    }
    return raw;
  } catch {
    return [];
  }
}

async function fetchMinuteOhlc(
  code: string,
  market: "KOSPI" | "KOSDAQ",
  minuteSize: MinuteSize,
  range?: string,
): Promise<{ bars: OhlcBar[]; source: string }> {
  const symbols = yahooSymbolCandidates(code, market);
  const plan = yahooMinutePlan(minuteSize, range);
  const tryRanges = [plan.range];
  if (plan.yahooInterval === "1m") {
    for (const r of ["7d", "5d", "1d"]) {
      if (!tryRanges.includes(r)) tryRanges.push(r);
    }
  } else if (plan.yahooInterval === "60m") {
    for (const r of ["2y", "1y", "6mo", "3mo", "1mo"]) {
      if (!tryRanges.includes(r)) tryRanges.push(r);
    }
  } else {
    for (const r of ["60d", "1mo", "5d", "1d"]) {
      if (!tryRanges.includes(r)) tryRanges.push(r);
    }
  }

  let raw: Omit<OhlcBar, "ma5" | "ma20" | "ma60" | "ma120">[] = [];
  let source = "yahoo-minute";

  for (const symbol of symbols) {
    for (const rng of tryRanges) {
      try {
        const data = await getJson<{
          chart: {
            result?: {
              timestamp: number[];
              indicators: {
                quote: {
                  open: (number | null)[];
                  high: (number | null)[];
                  low: (number | null)[];
                  close: (number | null)[];
                  volume: (number | null)[];
                }[];
              };
            }[];
          };
        }>(
          `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${plan.yahooInterval}&range=${rng}&includePrePost=false`,
        );
        const result = data.chart.result?.[0];
        if (!result?.timestamp?.length) continue;
        raw = parseYahooMinuteResult(result);
        if (raw.length) {
          source = `yahoo-${symbol}-${plan.yahooInterval}-${rng}`;
          break;
        }
      } catch {
        /* try next */
      }
    }
    if (raw.length) break;
  }

  if (raw.length < 30) {
    const naver = await fetchNaverMinuteFchart(code);
    if (naver.length > raw.length) {
      raw = naver;
      source = "naver-fchart-minute";
    }
  }

  if (!raw.length) return { bars: [], source: "minute-empty" };

  let grouped = raw;
  if (plan.yahooInterval === "1m" && minuteSize > 1) {
    grouped = bucketMinuteBars(raw, minuteSize);
  } else if (plan.yahooInterval === "5m" && minuteSize === 10) {
    grouped = bucketMinuteBars(raw, 10);
  }

  return { bars: withMas(grouped), source };
}

type YahooChartResult = {
  timestamp?: number[];
  events?: {
    dividends?: Record<string, { amount?: number; date?: number }>;
    splits?: Record<string, { date?: number; numerator?: number; denominator?: number; splitRatio?: string }>;
  };
  indicators?: {
    quote?: {
      open?: (number | null)[];
      high?: (number | null)[];
      low?: (number | null)[];
      close?: (number | null)[];
      volume?: (number | null)[];
    }[];
    adjclose?: { adjclose?: (number | null)[] }[];
  };
};

function wallClock(tsSec: number, withTime: boolean): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit" as const, minute: "2-digit" as const } : {}),
  }).formatToParts(new Date(tsSec * 1000));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const ymd = `${g("year")}-${g("month")}-${g("day")}`;
  if (!withTime) return ymd;
  const hour = g("hour") === "24" ? "00" : g("hour");
  return `${ymd} ${hour}:${g("minute")}`;
}

function roundPx(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function parseUsYahooBars(
  result: YahooChartResult,
  withTime: boolean,
): Omit<OhlcBar, "ma5" | "ma20" | "ma60" | "ma120">[] {
  const ts = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0];
  if (!q || !ts.length) return [];
  const adj = result.indicators?.adjclose?.[0]?.adjclose ?? [];
  const raw: Omit<OhlcBar, "ma5" | "ma20" | "ma60" | "ma120">[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i];
    const h = q.high?.[i];
    const l = q.low?.[i];
    const c = q.close?.[i];
    if (o == null || h == null || l == null || c == null) continue;
    if (!(c > 0)) continue;
    const stamp = ts[i];
    if (typeof stamp !== "number") continue;
    const factor = adj[i] != null && adj[i]! > 0 ? adj[i]! / c : 1;
    const open = roundPx(o * factor);
    const high = roundPx(Math.max(h, o, c) * factor);
    const low = roundPx(Math.min(l, o, c) * factor);
    const close = roundPx(c * factor);
    if (!(close > 0) || !(high > 0) || !(low > 0)) continue;
    const date = wallClock(stamp, withTime);
    if (!date || seen.has(date)) continue;
    seen.add(date);
    raw.push({
      date,
      label: withTime ? date.slice(5) : date.slice(5).replace("-", "/"),
      open,
      high: Math.max(high, open, close),
      low: Math.min(low, open, close),
      close,
      ...chartVolume(q.volume?.[i]),
      bullish: close >= open,
    });
  }
  return raw;
}

async function fetchYahooChart(symbol: string, interval: string, range: string, opts: { prePost?: boolean; events?: boolean } = {}): Promise<YahooChartResult | null> {
  for (const host of ["query1", "query2"]) {
    try {
      const data = await getJson<{ chart?: { result?: YahooChartResult[] } }>(
        `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includeAdjustedClose=true&includePrePost=${opts.prePost ? "true" : "false"}${opts.events ? "&events=div%2Csplits" : ""}`,
      );
      const result = data.chart?.result?.[0];
      if (result?.timestamp?.length) return result;
    } catch {
      /* next host */
    }
  }
  return null;
}

/** Internal daily collector only: fixed benchmark allowlist, shared HTTP policy.
 * Security ticker validation remains unchanged; no arbitrary proxy is exposed. */
export async function fetchDiscoveryBenchmark(symbol: "^KS11" | "^KQ11" | "^GSPC" | "^NDX" | "^IXIC") {
  if (!["^KS11", "^KQ11", "^GSPC", "^NDX", "^IXIC"].includes(symbol)) throw new Error("UNSUPPORTED_BENCHMARK");
  const result = await fetchYahooChart(symbol, "1d", "5y");
  if (!result) return { bars: [], source: `yahoo-${symbol}-unavailable` };
  const zone = symbol === "^KS11" || symbol === "^KQ11" ? "Asia/Seoul" : "America/New_York";
  const quotes = result.indicators?.quote?.[0], bars: import("../lib/bollinger/types").BollingerBar[] = [];
  for (let i = 0; i < (result.timestamp?.length ?? 0); i++) {
    const open = quotes?.open?.[i], high = quotes?.high?.[i], low = quotes?.low?.[i], close = quotes?.close?.[i];
    if (![open, high, low, close].every(v => typeof v === "number" && Number.isFinite(v) && v > 0)) continue;
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(result.timestamp![i]! * 1000));
    bars.push({ date, open: open!, high: high!, low: low!, close: close!, ...chartVolume(quotes?.volume?.[i]) });
  }
  return { bars, source: `yahoo-${symbol}-daily-price-index` };
}

/** Dividends / splits from the Yahoo chart `events` block (F7.10); only what the response carries. */
export interface ChartEvents {
  dividends: { date: string; amount: number }[];
  splits: { date: string; ratio: string }[];
}

function parseYahooEvents(result: YahooChartResult): ChartEvents | undefined {
  const ev = result.events;
  if (!ev) return undefined;
  const day = (sec: number | undefined) => (typeof sec === "number" ? wallClock(sec, false) : "");
  const dividends = Object.values(ev.dividends ?? {})
    .filter((d) => typeof d.amount === "number" && d.amount > 0 && typeof d.date === "number")
    .map((d) => ({ date: day(d.date), amount: d.amount! }))
    .filter((d) => d.date);
  const splits = Object.values(ev.splits ?? {})
    .filter((d) => typeof d.date === "number" && (d.splitRatio || (d.numerator && d.denominator)))
    .map((d) => ({ date: day(d.date), ratio: d.splitRatio ?? `${d.numerator}:${d.denominator}` }))
    .filter((d) => d.date);
  return { dividends, splits };
}

/** Split-adjusted US OHLC. Prices stay in dollars (not rounded to a won). */
async function fetchUsOhlc(opts: {
  code: string;
  interval: ChartInterval;
  minuteSize?: MinuteSize;
  range?: string;
  prePost?: boolean;
}): Promise<{ bars: OhlcBar[]; source: string; events?: ChartEvents }> {
  const symbol = yahooUsSymbol(opts.code);
  if (!symbol) return { bars: [], source: "us-invalid" };
  const interval = opts.interval;
  let yahooInterval = "1d";
  let range = opts.range ?? "5y";
  let bucket = 1;
  if (interval === "minute") {
    const plan = yahooMinutePlan(opts.minuteSize ?? 5, opts.range);
    yahooInterval = plan.yahooInterval;
    range = plan.range;
    bucket = plan.bucket;
  } else if (interval === "week") {
    yahooInterval = "1wk";
    range = opts.range ?? "10y";
  } else if (interval === "month" || interval === "year") {
    yahooInterval = interval === "year" ? "3mo" : "1mo";
    range = opts.range ?? "max";
  } else {
    yahooInterval = "1d";
    range = opts.range ?? "5y";
  }

  const prePost = interval === "minute" && Boolean(opts.prePost);
  const result = await fetchYahooChart(symbol, yahooInterval, range, { prePost, events: interval === "day" || interval === "week" });
  if (!result) return { bars: [], source: "us-yahoo-empty" };
  const events = parseYahooEvents(result);
  let raw = parseUsYahooBars(result, interval === "minute");
  if (interval === "minute" && bucket > 1) raw = bucketMinuteBars(raw, bucket);
  if (!raw.length) return { bars: [], source: "us-ohlc-empty" };

  if (interval === "year") {
    const byYear = new Map<string, typeof raw>();
    for (const bar of raw) {
      const y = bar.date.slice(0, 4);
      const list = byYear.get(y) ?? [];
      list.push(bar);
      byYear.set(y, list);
    }
    const yearly: typeof raw = [];
    for (const [y, list] of [...byYear.entries()].sort()) { // ked-allow-string-date-sort: single-format time series
      const first = list[0]!;
      const last = list[list.length - 1]!;
      yearly.push({
        date: `${y}-01-01`,
        label: y,
        open: first.open,
        high: Math.max(...list.map((x) => x.high)),
        low: Math.min(...list.map((x) => x.low)),
        close: last.close,
        volume: list.reduce((s, x) => s + x.volume, 0),
        volumeValid: list.every((x) => x.volumeValid !== false),
        bullish: last.close >= first.open,
      });
    }
    raw = yearly;
  }

  return { bars: withMas(raw, { round: false }), source: `yahoo-us-${symbol}-${yahooInterval}${prePost ? "-prepost" : ""}`, events };
}

// ── OHLC ────────────────────────────────────────────────────────────────

export async function fetchOhlc(opts: {
  code: string;
  market: "KOSPI" | "KOSDAQ" | "US";
  interval: ChartInterval;
  minuteSize?: MinuteSize;
  range?: string;
  prePost?: boolean;
}): Promise<{ bars: OhlcBar[]; source: string; events?: ChartEvents }> {
  const { code, market, interval } = opts;
  if (market === "US") {
    return fetchUsOhlc({
      code,
      interval,
      minuteSize: opts.minuteSize,
      range: opts.range,
      prePost: opts.prePost,
    });
  }

  if (interval === "minute") {
    return fetchMinuteOhlc(code, market, opts.minuteSize ?? 5, opts.range);
  }

  const intervalMap: Record<string, { interval: string; range: string }> = {
    day: { interval: "1d", range: opts.range ?? "5y" },
    week: { interval: "1wk", range: opts.range ?? "5y" },
    month: { interval: "1mo", range: opts.range ?? "max" },
    year: { interval: "3mo", range: opts.range ?? "max" },
  };
  const conf = intervalMap[interval] ?? intervalMap.day!;

  let raw: Omit<OhlcBar, "ma5" | "ma20" | "ma60" | "ma120">[] = [];
  let source = "yahoo";

  for (const symbol of yahooSymbolCandidates(code, market)) {
    try {
      const data = await getJson<{
        chart: {
          result?: {
            timestamp: number[];
            indicators: {
              quote: {
                open: (number | null)[];
                high: (number | null)[];
                low: (number | null)[];
                close: (number | null)[];
                volume: (number | null)[];
              }[];
            };
          }[];
        };
      }>(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${conf.interval}&range=${conf.range}`,
      );
      const result = data.chart.result?.[0];
      if (!result?.timestamp?.length) continue;
      const q = result.indicators.quote[0]!;
      const parsed: typeof raw = [];
      for (let i = 0; i < result.timestamp.length; i++) {
        const o = q.open[i];
        const h = q.high[i];
        const l = q.low[i];
        const c = q.close[i];
        const v = q.volume[i];
        if (o == null || h == null || l == null || c == null) continue;
        const kst = new Date(result.timestamp[i]! * 1000 + 9 * 3600 * 1000);
        const date = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
        parsed.push({
          date,
          label:
            interval === "year" || interval === "month"
              ? `${kst.getUTCFullYear()}.${String(kst.getUTCMonth() + 1).padStart(2, "0")}`
              : `${kst.getUTCMonth() + 1}/${kst.getUTCDate()}`,
          open: Math.round(o),
          high: Math.round(h),
          low: Math.round(l),
          close: Math.round(c),
          ...chartVolume(v),
          bullish: c >= o,
        });
      }
      if (parsed.length) {
        raw = parsed;
        source = `yahoo-${symbol}`;
        break;
      }
    } catch {
      /* try next suffix / Naver */
    }
  }

  if (!raw.length) {
    const tf =
      interval === "week" ? "week" : interval === "month" || interval === "year" ? "month" : "day";
    const count = interval === "day" ? 1200 : interval === "week" ? 400 : 180;
    const naver = await fetchNaverFchart(code, tf, count);
    if (naver.length) {
      raw = naver;
      source = `naver-fchart-${tf}`;
    }
  }

  if (!raw.length && interval === "day") {
    return fetchNaverDayOhlc(code);
  }

  if (!raw.length) return { bars: [], source: "ohlc-empty" };

  if (interval === "year") {
    const byYear = new Map<string, typeof raw>();
    for (const b of raw) {
      const y = b.date.slice(0, 4);
      const list = byYear.get(y) ?? [];
      list.push(b);
      byYear.set(y, list);
    }
    const yearly: typeof raw = [];
    for (const [y, list] of [...byYear.entries()].sort()) { // ked-allow-string-date-sort: single-format time series
      const first = list[0]!;
      const last = list[list.length - 1]!;
      yearly.push({
        date: `${y}-01-01`,
        label: y,
        open: first.open,
        high: Math.max(...list.map((x) => x.high)),
        low: Math.min(...list.map((x) => x.low)),
        close: last.close,
        volume: list.reduce((s, x) => s + x.volume, 0),
        volumeValid: list.every((x) => x.volumeValid !== false),
        bullish: last.close >= first.open,
      });
    }
    return { bars: withMas(yearly), source };
  }

  return { bars: withMas(raw), source };
}

async function fetchNaverFchart(
  code: string,
  timeframe: "day" | "week" | "month",
  count: number,
): Promise<Omit<OhlcBar, "ma5" | "ma20" | "ma60" | "ma120">[]> {
  try {
    const xml = await getText(
      `https://fchart.stock.naver.com/sise.nhn?symbol=${code}&timeframe=${timeframe}&count=${count}&requestType=0`,
    );
    const items = [...xml.matchAll(/item data="([^"]+)"/g)].map((m) => m[1]!);
    const raw: Omit<OhlcBar, "ma5" | "ma20" | "ma60" | "ma120">[] = [];
    for (const row of items) {
      const [dt, o, h, l, c, v] = row.split("|");
      if (!dt || dt.length < 8) continue;
      const ymd = `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`;
      const close = num(c);
      if (!close) continue;
      const open = num(o) || close;
      const high = num(h) || close;
      const low = num(l) || close;
      raw.push({
        date: ymd,
        label: `${Number(dt.slice(4, 6))}/${Number(dt.slice(6, 8))}`,
        open,
        high: Math.max(high, open, close),
        low: Math.min(low, open, close),
        close,
        ...chartVolume(v),
        bullish: close >= open,
      });
    }
    return raw;
  } catch {
    return [];
  }
}

async function fetchNaverDayOhlc(
  code: string,
): Promise<{ bars: OhlcBar[]; source: string }> {
  const end = new Date();
  const start = new Date();
  start.setFullYear(start.getFullYear() - 5);
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const text = await getText(
    `https://api.finance.naver.com/siseJson.naver?symbol=${code}&requestType=1&startTime=${fmt(start)}&endTime=${fmt(end)}&timeframe=day`,
  );
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return { bars: [], source: "naver" };
  let rows: unknown[];
  try {
    const normalized = match[0].replace(/'/g, '"');
    rows = JSON.parse(normalized) as unknown[];
  } catch {
    return { bars: [], source: "naver-parse-error" };
  }
  const raw: Omit<OhlcBar, "ma5" | "ma20" | "ma60" | "ma120">[] = [];
  for (const row of rows) {
    if (!Array.isArray(row) || typeof row[0] !== "string") continue;
    const ymd = String(row[0]);
    if (!/^\d{8}$/.test(ymd)) continue;
    const date = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
    const open = num(row[1]);
    const high = num(row[2]);
    const low = num(row[3]);
    const close = num(row[4]);
    const volume = chartVolume(row[5]);
    raw.push({
      date,
      label: `${Number(ymd.slice(4, 6))}/${Number(ymd.slice(6, 8))}`,
      open,
      high,
      low,
      close,
      ...volume,
      bullish: close >= open,
    });
  }
  return { bars: withMas(raw), source: "naver" };
}

// ── Investor flow ───────────────────────────────────────────────────────

export async function fetchInvestorFlow(
  code: string,
): Promise<{ days: FlowDay[]; source: string }> {
  const urls = [
    `https://m.stock.naver.com/api/stock/${code}/trend`,
    `https://m.stock.naver.com/front-api/product/trend?reutersCode=${code}`,
  ];
  let rows: {
    bizdate?: string;
    localBizDate?: string;
    foreignerPureBuyQuant?: string | number;
    organPureBuyQuant?: string | number;
    individualPureBuyQuant?: string | number;
    closePrice?: string;
    foreignerHoldRatio?: string;
  }[] = [];
  let source = "naver-trend";
  for (const url of urls) {
    try {
      const raw = await getJson<unknown>(url);
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { result?: unknown }).result)
          ? ((raw as { result: unknown[] }).result)
          : [];
      if (list.length) {
        rows = list as typeof rows;
        source = url.includes("front-api") ? "naver-front-trend" : "naver-trend";
        break;
      }
    } catch {
      /* next */
    }
  }

  const days = (rows ?? [])
    .map((r) => {
      const bd = String(r.bizdate ?? r.localBizDate ?? "").replace(/\D/g, "");
      if (bd.length < 8) return null;
      return {
        date: `${bd.slice(0, 4)}-${bd.slice(4, 6)}-${bd.slice(6, 8)}`,
        label: `${Number(bd.slice(4, 6))}/${Number(bd.slice(6, 8))}`,
        foreign: parseSignedShares(r.foreignerPureBuyQuant),
        institution: parseSignedShares(r.organPureBuyQuant),
        individual: parseSignedShares(r.individualPureBuyQuant),
        close: num(String(r.closePrice ?? "0").replace(/,/g, "")),
        foreignHoldRatio: r.foreignerHoldRatio
          ? num(String(r.foreignerHoldRatio).replace(/%/g, ""))
          : undefined,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d != null)
    .sort((a, b) => a.date.localeCompare(b.date)); // ked-allow-string-date-sort: single-format time series

  return { days, source };
}

// ── Research ────────────────────────────────────────────────────────────

const CAT_LABEL: Record<ResearchCategory, string> = {
  company: "기업",
  industry: "산업",
  market: "시황·전략",
  economy: "경제",
};

const PC_PATH: Record<ResearchCategory, string> = {
  company: "company_read.naver",
  industry: "industry_read.naver",
  market: "invest_read.naver",
  economy: "economy_read.naver",
};

const API_DETAIL: Record<ResearchCategory, string> = {
  company: "company",
  industry: "industry",
  market: "invest",
  economy: "economy",
};

type NaverResearchRow = {
  researchId: number;
  itemCode?: string;
  itemName?: string;
  title: string;
  brokerName: string;
  writeDate: string;
  previewContent?: string;
  readCount?: string | number;
  researchCategory?: string;
  category?: string;
  endUrl?: string;
  attachUrl?: string;
};

async function enrichFromApiDetail(
  researchId: number,
  kind: ResearchCategory,
): Promise<{
  rating?: string;
  targetPrice?: number;
  pdfUrl?: string;
  previewExtra?: string;
}> {
  const apiKind = API_DETAIL[kind];
  try {
    const j = await getJson<{
      researchContent?: {
        content?: string;
        attachUrl?: string;
        title?: string;
      };
    }>(`https://m.stock.naver.com/api/research/${apiKind}/${researchId}`);
    const rc = j.researchContent;
    if (!rc) return {};
    const plain = htmlToText(rc.content ?? "");
    const extracted = extractTargetAndRating(plain);
    return {
      rating: extracted.rating,
      targetPrice: extracted.targetPrice,
      pdfUrl: rc.attachUrl || undefined,
      previewExtra: plain.slice(0, 420),
    };
  } catch {
    return {};
  }
}

export async function enrichResearchFromPage(
  researchId: number,
  kind: ResearchCategory = "company",
): Promise<{
  rating?: string;
  targetPrice?: number;
  pdfUrl?: string;
  pageUrl: string;
  previewExtra?: string;
}> {
  const pageUrl = `https://finance.naver.com/research/${PC_PATH[kind]}?nid=${researchId}`;
  try {
    const text = await getEucKr(pageUrl);
    const extracted = extractTargetAndRating(text);
    const coment = text.match(/class=["']coment["'][^>]*>\s*([^<]+)\s*</i);
    if (coment && !extracted.rating) {
      extracted.rating = normalizeRating(coment[1]!);
    }
    const money = text.match(/목표가\s*<em[^>]*>\s*([^<]+)\s*</i);
    if (money && !extracted.targetPrice) {
      const t = money[1]!.replace(/[^\d,]/g, "");
      if (t && t !== "없음") {
        const n = num(t);
        if (n >= 1000) extracted.targetPrice = n;
      }
    }
    const pdf =
      text.match(
        /https?:\/\/stock\.pstatic\.net\/stock-research\/[^"'\\\s>]+\.pdf/i,
      )?.[0] ?? text.match(/https?:\/\/[^"'\\\s>]+\.pdf/i)?.[0];
    return {
      rating: extracted.rating,
      targetPrice: extracted.targetPrice,
      pdfUrl: pdf,
      pageUrl,
    };
  } catch {
    return { pageUrl };
  }
}

function mapResearchRow(
  r: NaverResearchRow,
  category: ResearchCategory,
): ResearchReport {
  const preview = r.previewContent ?? "";
  const blob = `${r.title} ${preview}`;
  const extracted = extractTargetAndRating(blob);
  return {
    researchId: r.researchId,
    code: r.itemCode,
    nameKo: r.itemName,
    title: r.title,
    broker: r.brokerName,
    date: r.writeDate,
    preview,
    rating: extracted.rating,
    targetPrice: extracted.targetPrice,
    category,
    categoryLabel: CAT_LABEL[category],
    pdfUrl: r.attachUrl,
    pageUrl: `https://finance.naver.com/research/${PC_PATH[category]}?nid=${r.researchId}`,
    readCount: r.readCount ? num(r.readCount) : undefined,
    summary: buildResearchExecutiveSummary(preview, r.title),
    sectorIds: classifyResearchSectors(blob),
    tags: [],
    hasInvestmentView: Boolean(extracted.rating || extracted.targetPrice),
  };
}

async function enrichReports(
  reports: ResearchReport[],
  limit = 12,
): Promise<ResearchReport[]> {
  const head = reports.slice(0, limit);
  const tail = reports.slice(limit);
  // List path: API detail only (parallel). Page HTML scrape deferred to PDF open —
  // sequential page fetches were the #1 research latency killer.
  const enriched = await Promise.all(
    head.map(async (r) => {
      const api = await enrichFromApiDetail(r.researchId, r.category);
      let rating = r.rating ?? api.rating;
      const targetPrice = r.targetPrice ?? api.targetPrice;
      const pdfUrl = r.pdfUrl ?? api.pdfUrl;
      let preview = r.preview;

      if (api.previewExtra && (!preview || preview.length < api.previewExtra.length)) {
        preview = api.previewExtra;
      }

      rating = normalizeRating(rating);

      return {
        ...r,
        rating,
        targetPrice,
        pdfUrl,
        preview,
        summary: buildResearchExecutiveSummary(preview, r.title),
        sectorIds: classifyResearchSectors(`${r.title} ${preview}`),
        hasInvestmentView: Boolean(rating || targetPrice),
      };
    }),
  );
  const normalizedTail = tail.map((r) => ({
    ...r,
    rating: normalizeRating(r.rating),
    summary: r.summary || buildResearchExecutiveSummary(r.preview, r.title),
    sectorIds: r.sectorIds?.length ? r.sectorIds : classifyResearchSectors(`${r.title} ${r.preview}`),
    hasInvestmentView: Boolean(normalizeRating(r.rating) || r.targetPrice),
  }));
  return [...enriched, ...normalizedTail];
}

export async function fetchResearchList(code: string): Promise<ResearchReport[]> {
  const rows = await getJson<NaverResearchRow[]>(
    `https://m.stock.naver.com/api/research/stock/${code}`,
  );
  const list = (rows ?? []).map((r) => mapResearchRow(r, "company"));
  return enrichReports(list, 6);
}

export async function fetchCategoryResearch(
  category: Exclude<ResearchCategory, "company">,
  limit = 15,
): Promise<ResearchReport[]> {
  const apiPath = category === "market" ? "invest" : category;
  try {
    const rows = await getJson<NaverResearchRow[]>(
      `https://m.stock.naver.com/api/research/${apiPath}`,
    );
    let list = (rows ?? [])
      .slice(0, limit)
      .map((r) => mapResearchRow(r, category));

    if (category === "market") {
      try {
        const marketRows = await getJson<NaverResearchRow[]>(
          `https://m.stock.naver.com/api/research/market`,
        );
        const extra = (marketRows ?? [])
          .slice(0, 10)
          .map((r) => mapResearchRow(r, "market"));
        const seen = new Set(list.map((x) => x.researchId));
        for (const e of extra) {
          if (!seen.has(e.researchId)) list.push(e);
        }
        list = sortReportsNewestFirst(list).slice(0, limit);
      } catch {
        /* optional */
      }
    }

    return enrichReports(list, Math.min(5, limit));
  } catch {
    return [];
  }
}

export async function fetchResearchPack(code: string): Promise<{
  company: ResearchReport[];
  industry: ResearchReport[];
  market: ResearchReport[];
  economy: ResearchReport[];
}> {
  const [company, industryAll, market, economy] = await Promise.all([
    fetchResearchList(code).catch(() => [] as ResearchReport[]),
    fetchCategoryResearch("industry", 30).catch(() => [] as ResearchReport[]),
    fetchCategoryResearch("market", 12).catch(() => [] as ResearchReport[]),
    fetchCategoryResearch("economy", 12).catch(() => [] as ResearchReport[]),
  ]);
  const sectorId = UNIVERSE.find((u) => u.code === code)?.sectorId;
  const industry = sectorId
    ? industryAll.filter((r) => r.sectorIds.includes(sectorId)).slice(0, 12)
    : industryAll.slice(0, 12);
  return { company, industry, market, economy };
}

/**
 * Market-wide legacy research desk (fallback path only). The former fixed
 * 7-stock "featured" list is gone (D6/AT-18): company research now pages the
 * full v2 category (`src/server/research-v2.ts`).
 */
export async function fetchResearchDesk(): Promise<{
  industry: ResearchReport[];
  market: ResearchReport[];
  economy: ResearchReport[];
  featured: ResearchReport[];
}> {
  const [industry, market, economy] = await Promise.all([
    fetchCategoryResearch("industry", 40).catch(() => [] as ResearchReport[]),
    fetchCategoryResearch("market", 40).catch(() => [] as ResearchReport[]),
    fetchCategoryResearch("economy", 40).catch(() => [] as ResearchReport[]),
  ]);
  return { industry, market, economy, featured: [] };
}

/** Deep research detail — used on PDF/원문 click & detail sheet open (not list path). */
const researchDeepCache = new Map<
  string,
  {
    at: number;
    data: {
      pdfUrl?: string;
      pageUrl: string;
      rating?: string;
      targetPrice?: number;
      previewExtra?: string;
    };
  }
>();
const RESEARCH_DEEP_TTL_MS = 10 * 60_000;

export async function fetchResearchPdf(
  researchId: number,
  category: ResearchCategory = "company",
): Promise<{
  pdfUrl?: string;
  pageUrl: string;
  rating?: string;
  targetPrice?: number;
  previewExtra?: string;
}> {
  const key = `${category}:${researchId}`;
  const now = Date.now();
  const hit = researchDeepCache.get(key);
  if (hit && now - hit.at < RESEARCH_DEEP_TTL_MS) return hit.data;

  // Parallel: mobile API detail + PC page scrape for rating / TP / PDF
  const [api, page] = await Promise.all([
    enrichFromApiDetail(researchId, category),
    enrichResearchFromPage(researchId, category),
  ]);

  const rating = normalizeRating(api.rating ?? page.rating);
  const targetPrice = api.targetPrice ?? page.targetPrice;
  const pdfUrl = api.pdfUrl || page.pdfUrl;
  const previewExtra =
    (api.previewExtra && api.previewExtra.length >= 40
      ? api.previewExtra
      : undefined) ??
    page.previewExtra;

  const data = {
    pdfUrl,
    pageUrl:
      page.pageUrl ||
      `https://finance.naver.com/research/${PC_PATH[category]}?nid=${researchId}`,
    rating,
    targetPrice,
    previewExtra,
  };
  researchDeepCache.set(key, { at: now, data });
  if (researchDeepCache.size > 200) {
    const first = researchDeepCache.keys().next().value;
    if (first) researchDeepCache.delete(first);
  }
  return data;
}

// ── News ────────────────────────────────────────────────────────────────

export async function fetchNews(code: string, page = 1): Promise<NewsItem[]> {
  const data = await getJson<
    {
      items?: {
        id?: string;
        officeId?: string;
        articleId?: string;
        titleFull?: string;
        title?: string;
        body?: string;
        officeName?: string;
        datetime?: string;
        mobileNewsUrl?: string;
      }[];
    }[]
  >(`https://m.stock.naver.com/api/news/stock/${code}?pageSize=20&page=${Math.max(1, Math.min(page, 20))}`);

  const items: NewsItem[] = [];
  for (const group of data ?? []) {
    for (const it of group.items ?? []) {
      const dt = it.datetime ?? "";
      const iso =
        dt.length >= 12
          ? `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}T${dt.slice(8, 10)}:${dt.slice(10, 12)}:00+09:00`
          : dt;
      items.push({
        id: it.id ?? `${it.officeId}${it.articleId}`,
        title: it.titleFull ?? it.title ?? "",
        body: it.body ?? "",
        source: it.officeName ?? "언론",
        datetime: iso,
        url:
          it.mobileNewsUrl ??
          (it.officeId && it.articleId
            ? `https://n.news.naver.com/mnews/article/${it.officeId}/${it.articleId}`
            : ""),
      });
    }
  }
  return items;
}

// ── Disclosures (Naver body + DART — never kind.kr) ───────────────────

type NaverDisclosureRow = {
  itemCode?: string;
  disclosureId: number | string;
  title: string;
  datetime: string;
  author?: string;
};

export async function fetchDisclosures(
  code: string,
  nameKo?: string,
): Promise<DisclosureItem[]> {
  const rows = await getJson<NaverDisclosureRow[]>(
    `https://m.stock.naver.com/api/stock/${code}/disclosure?pageSize=30`,
  );
  const searchName = nameKo ?? code;
  const search = dartSearchUrl(searchName);

  return (rows ?? []).map((d) => ({
    id: String(d.disclosureId),
    title: d.title,
    datetime: d.datetime,
    author: d.author ?? "공시",
    code: d.itemCode ?? code,
    nameKo,
    dartSearchUrl: search,
    canLoadBody: true,
  }));
}

export async function fetchDisclosureDetail(
  code: string,
  disclosureId: string,
): Promise<DisclosureDetail> {
  const nameKo = UNIVERSE.find((u) => u.code === code)?.nameKo;
  const search = dartSearchUrl(nameKo ?? code);

  const data = await getJson<{
    itemCode?: string;
    disclosure?: {
      itemCode?: string;
      disclosureId?: number | string;
      datetime?: string;
      contents?: string;
      title?: string;
      author?: string;
      comment?: string;
    };
  }>(`https://m.stock.naver.com/api/stock/${code}/disclosure/${disclosureId}`);

  const d = data.disclosure;
  if (!d) {
    return {
      id: disclosureId,
      code,
      title: "공시를 불러오지 못했습니다",
      datetime: "",
      author: "공시",
      html: "",
      text: "본문을 불러오지 못했습니다. DART에서 검색해 주세요.",
      dartSearchUrl: search,
    };
  }

  const rawHtml = d.contents ?? "";
  const rcpNo = extractRcpNo(rawHtml);
  const dartUrl = rcpNo ? dartViewerUrl(rcpNo) : undefined;
  // Keep the UI on escaped plaintext. External disclosure HTML is not trusted DOM.
  const sanitizedForText = sanitizeDisclosureHtml(rawHtml, rcpNo);
  const text = htmlToText(sanitizedForText);

  return {
    id: String(d.disclosureId ?? disclosureId),
    code: d.itemCode ?? code,
    title: d.title ?? "",
    datetime: d.datetime ?? "",
    author: d.author ?? "공시",
    html: "",
    text,
    rcpNo,
    dartUrl,
    dartSearchUrl: search,
  };
}

// ── Indices (KRX via Naver realtime) ────────────────────────────────────

const INDEX_META: {
  cd: string;
  id: string;
  nameKo: string;
  nameEn: string;
}[] = [
  { cd: "KOSPI", id: "kospi", nameKo: "코스피", nameEn: "KOSPI" },
  { cd: "KOSDAQ", id: "kosdaq", nameKo: "코스닥", nameEn: "KOSDAQ" },
  { cd: "KPI200", id: "kpi200", nameKo: "코스피200", nameEn: "KOSPI 200" },
];

/** Naver polling stores index levels ×100 (integer). */
function scaleIndex(v: number): number {
  return Math.round(v) / 100;
}

export async function fetchIndices(): Promise<IndexQuote[]> {
  // Primary: KRX exchange feed via Naver realtime polling
  try {
    const codes = INDEX_META.map((x) => x.cd).join(",");
    const data = await getJson<{
      result?: {
        areas?: {
          datas?: {
            cd: string;
            nv: number;
            cv: number;
            cr: number;
            ov?: number;
            hv?: number;
            lv?: number;
            ms?: string;
          }[];
        }[];
      };
    }>(
      `https://polling.finance.naver.com/api/realtime?query=SERVICE_INDEX:${codes}`,
    );
    const datas = data.result?.areas?.[0]?.datas ?? [];
    if (datas.length > 0) {
      const out: IndexQuote[] = [];
      for (const meta of INDEX_META) {
        const row = datas.find((d) => d.cd === meta.cd);
        if (!row) continue;
        out.push({
          id: meta.id,
          nameKo: meta.nameKo,
          nameEn: meta.nameEn,
          value: scaleIndex(num(row.nv)),
          change: scaleIndex(num(row.cv)),
          changePct: num(row.cr),
          marketStatus: row.ms,
          open: row.ov != null ? scaleIndex(num(row.ov)) : undefined,
          high: row.hv != null ? scaleIndex(num(row.hv)) : undefined,
          low: row.lv != null ? scaleIndex(num(row.lv)) : undefined,
          source: "naver-finance-snapshot",
        });
      }
      if (out.length) return out;
    }
  } catch {
    /* fall through */
  }

  // Fallback: mobile basic endpoints
  const out: IndexQuote[] = [];
  for (const meta of INDEX_META) {
    try {
      const basic = await getJson<{
        closePrice?: string;
        compareToPreviousClosePrice?: string;
        fluctuationsRatio?: string | number;
        marketStatus?: string;
        openPrice?: string;
        highPrice?: string;
        lowPrice?: string;
      }>(`https://m.stock.naver.com/api/index/${meta.cd}/basic`);
      out.push({
        id: meta.id,
        nameKo: meta.nameKo,
        nameEn: meta.nameEn,
        value: num(basic.closePrice),
        change: num(basic.compareToPreviousClosePrice),
        changePct: num(basic.fluctuationsRatio),
        marketStatus: basic.marketStatus,
        open: basic.openPrice ? num(basic.openPrice) : undefined,
        high: basic.highPrice ? num(basic.highPrice) : undefined,
        low: basic.lowPrice ? num(basic.lowPrice) : undefined,
        source: "naver-finance-snapshot",
      });
    } catch {
      /* skip */
    }
  }
  return out;
}

export type StockValuation = {
  stockName?: string;
  stockExchangeName?: string;
  high52: number;
  low52: number;
  marketCapLabel?: string;
  /** Display strings from Naver */
  per?: string;
  pbr?: string;
  psr?: string;
  foreignRate?: string;
  tradedAt?: string;
  marketStatus?: string;
  /** Numeric fundamentals for valuation band chart (KRW per share) */
  price?: number;
  eps?: number;
  bps?: number;
  /** Sales per share = trailing annual sales / shares */
  sps?: number;
  perNum?: number;
  pbrNum?: number;
  psrNum?: number;
  /** Consensus (NTM) EPS / PER from Naver */
  cnsEps?: number;
  cnsPer?: number;
  /** How TTM EPS was obtained */
  epsSource?: "ttm-4q" | "naver-headline" | "fy" | "implied";
  /** Quarter keys used for TTM (e.g. 202603) */
  ttmQuarters?: string[];
  fyEps?: number;
  /** Market cap in KRW */
  marketCapKrw?: number;
  /** Latest annual sales in KRW */
  salesKrw?: number;
};

function parseNumLoose(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const raw = String(v).trim();
  if (!raw || raw === "-" || raw === "N/A" || raw === "—") return 0;
  const loss = /적자|손실/.test(raw);
  const compact = raw.replace(/,/g, "").replace(/\s/g, "");
  const m = compact.match(/-?\d+(?:\.\d+)?/);
  if (!m) return 0;
  let n = Number(m[0]);
  if (!Number.isFinite(n)) return 0;
  if (/조/.test(compact)) n *= 1_0000_0000_0000;
  else if (/억/.test(compact)) n *= 100_000_000;
  else if (/만/.test(compact) && !/원|배/.test(compact)) n *= 10_000;
  if (loss && n > 0) n = -n;
  return n;
}

/** Latest non-consensus column (raw number, not unit-converted). */
function latestReported(
  finance: {
    trTitleList?: { key: string; isConsensus?: string }[];
    rowList?: { title: string; columns?: Record<string, { value?: string }> }[];
  } | null,
  title: string,
): { value: number; key: string | null } {
  if (!finance?.rowList?.length) return { value: 0, key: null };
  const row = finance.rowList.find((r) => r.title === title);
  if (!row?.columns) return { value: 0, key: null };
  const keys = (finance.trTitleList ?? [])
    .filter((t) => t.isConsensus !== "Y")
    .map((t) => t.key)
    .reverse();
  for (const k of keys) {
    const v = parseNumLoose(row.columns[k]?.value);
    if (v !== 0) return { value: v, key: k };
  }
  return { value: 0, key: null };
}

/**
 * True TTM EPS = sum of last 4 reported (non-consensus) quarterly EPS.
 * Korean issuers report quarterly EPS already on a per-share basis.
 */
function ttmEpsFromQuarters(finance: {
  trTitleList?: { key: string; isConsensus?: string; title?: string }[];
  rowList?: { title: string; columns?: Record<string, { value?: string }> }[];
} | null): { eps: number; quarters: string[] } {
  if (!finance?.rowList?.length) return { eps: 0, quarters: [] };
  const row = finance.rowList.find((r) => r.title === "EPS");
  if (!row?.columns) return { eps: 0, quarters: [] };
  const keys = (finance.trTitleList ?? [])
    .filter((t) => t.isConsensus !== "Y")
    .map((t) => t.key)
    .reverse();
  const used: string[] = [];
  let sum = 0;
  for (const k of keys) {
    const raw = row.columns[k]?.value;
    if (raw == null || raw === "" || raw === "-") continue;
    const v = parseNumLoose(raw);
    // include negative (loss) quarters — they are part of TTM
    sum += v;
    used.push(k);
    if (used.length === 4) break;
  }
  return { eps: used.length === 4 ? sum : 0, quarters: used };
}

/** Latest non-consensus annual row value (억원 unit in Naver finance). */
function latestAnnualEok(
  finance: {
    trTitleList?: { key: string; isConsensus?: string }[];
    rowList?: { title: string; columns?: Record<string, { value?: string }> }[];
  } | null,
  title: string,
): number {
  return latestReported(finance, title).value;
}

export async function fetchStockBasic(code: string): Promise<StockValuation> {
  // Parallel fan-out: was ~2.3s sequential → ~0.7s parallel
  type BasicJ = {
    stockName?: string;
    stockExchangeName?: string;
    localTradedAt?: string;
    marketStatus?: string;
    closePrice?: string;
  };
  type IntegJ = { totalInfos?: { code: string; value: string }[] };
  type SumJ = {
    marketSum?: number;
    per?: number;
    eps?: number;
    pbr?: number;
    now?: number;
  };
  type FinJ = {
    financeInfo?: {
      trTitleList?: { key: string; isConsensus?: string }[];
      rowList?: {
        title: string;
        columns?: Record<string, { value?: string }>;
      }[];
    };
  };

  const [basicRes, integRes, summaryRes, finRes, qRes] = await Promise.all([
    getJson<BasicJ>(`https://m.stock.naver.com/api/stock/${code}/basic`).catch(
      () => null,
    ),
    getJson<IntegJ>(
      `https://m.stock.naver.com/api/stock/${code}/integration`,
    ).catch(() => null),
    getJson<SumJ>(
      `https://api.finance.naver.com/service/itemSummary.nhn?itemcode=${code}`,
    ).catch(() => null),
    getJson<FinJ>(
      `https://m.stock.naver.com/api/stock/${code}/finance/annual`,
    ).catch(() => null),
    getJson<FinJ>(
      `https://m.stock.naver.com/api/stock/${code}/finance/quarter`,
    ).catch(() => null),
  ]);

  const basic = basicRes ?? {};
  const map: Record<string, string> = Object.fromEntries(
    (integRes?.totalInfos ?? []).map((t) => [t.code, t.value]),
  );
  const summary: SumJ = summaryRes ?? {};
  const salesEok = latestAnnualEok(finRes?.financeInfo ?? null, "매출액");

  const price =
    parseNumLoose(summary.now) ||
    parseNumLoose(basic.closePrice) ||
    parseNumLoose(map.lastClosePrice);
  const headlineEps =
    parseNumLoose(summary.eps) || parseNumLoose(map.eps);
  const ttm = ttmEpsFromQuarters(qRes?.financeInfo ?? null);
  const fyEps = latestReported(finRes?.financeInfo ?? null, "EPS").value;

  let epsFinal = 0;
  let epsSource: StockValuation["epsSource"];
  if (ttm.eps !== 0) {
    epsFinal = ttm.eps;
    epsSource = "ttm-4q";
  } else if (headlineEps !== 0) {
    epsFinal = headlineEps;
    epsSource = "naver-headline";
  } else if (fyEps !== 0) {
    epsFinal = fyEps;
    epsSource = "fy";
  }

  const cnsEps = parseNumLoose(map.cnsEps);
  let perNum =
    parseNumLoose(summary.per) || parseNumLoose(map.per);
  if (!perNum && epsFinal !== 0 && price > 0) perNum = price / epsFinal;
  const cnsPer =
    parseNumLoose(map.cnsPer) ||
    (cnsEps > 0 && price > 0 ? price / cnsEps : 0);
  const pbrNum =
    parseNumLoose(summary.pbr) || parseNumLoose(map.pbr);
  // BPS from PBR: PBR = price/bps → bps = price/pbr
  let bps =
    parseNumLoose(map.bps) ||
    latestReported(finRes?.financeInfo ?? null, "BPS").value;
  if (!bps && pbrNum > 0 && price > 0) bps = price / pbrNum;
  if (!epsFinal && perNum > 0 && price > 0) {
    epsFinal = price / perNum;
    epsSource = "implied";
  }

  // marketSum is 백만원 (million KRW) on Naver itemSummary
  let marketCapKrw = 0;
  if (summary.marketSum && summary.marketSum > 0) {
    marketCapKrw = summary.marketSum * 1_000_000;
  }
  // sales is 억원 on Naver finance
  const salesKrw = salesEok > 0 ? salesEok * 100_000_000 : 0;

  let sps = 0;
  let psrNum = 0;
  if (salesKrw > 0 && marketCapKrw > 0 && price > 0) {
    const shares = marketCapKrw / price;
    if (shares > 0) {
      sps = salesKrw / shares;
      psrNum = price / sps;
    }
  } else if (salesKrw > 0 && marketCapKrw > 0) {
    psrNum = marketCapKrw / salesKrw;
  }

  return {
    stockName: basic.stockName,
    stockExchangeName: basic.stockExchangeName,
    high52: parseNumLoose(map.highPriceOf52Weeks),
    low52: parseNumLoose(map.lowPriceOf52Weeks),
    marketCapLabel: map.marketValue,
    per: map.per ?? (perNum ? perNum.toFixed(2) : undefined),
    pbr: map.pbr ?? (pbrNum ? pbrNum.toFixed(2) : undefined),
    psr: psrNum > 0 ? psrNum.toFixed(2) : undefined,
    foreignRate: map.foreignRate,
    tradedAt: basic.localTradedAt,
    marketStatus: basic.marketStatus,
    price: price || undefined,
    eps: epsFinal !== 0 ? epsFinal : undefined,
    bps: bps || undefined,
    sps: sps || undefined,
    perNum: perNum || undefined,
    pbrNum: pbrNum || undefined,
    psrNum: psrNum || undefined,
    cnsEps: cnsEps || undefined,
    cnsPer: cnsPer || undefined,
    epsSource,
    ttmQuarters: ttm.quarters.length ? ttm.quarters : undefined,
    fyEps: fyEps || undefined,
    marketCapKrw: marketCapKrw || undefined,
    salesKrw: salesKrw || undefined,
  };
}
