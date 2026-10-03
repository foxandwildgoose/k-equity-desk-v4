/**
 * Valuation history.
 * Korea: Yahoo adjusted weekly prices (10y) + Company Guide IFRS annual ratios.
 * United States: Yahoo adjusted weekly prices + SEC EDGAR companyfacts (TTM).
 * OpenDART needs an API key this deployment does not have, so it is not called.
 * Failures become an empty pack. Multiples are never invented.
 */
import {
  annualsFromCompanyFacts,
  buildValuationPack,
  emptyValuationPack,
  extractEncparam,
  parseAnnualFundamentals,
  parseBandMonthPrices,
  parseNasdaqEarningsForecast,
  parseYahooAdjCloses,
  parseYahooSplits,
  sharesOnPriceBasis,
  yahooUsSymbol,
  type ConsensusEps,
  type MonthPrice,
  type SplitEvent,
  type ValuationPack,
} from "@/lib/valuation-series";
import { normalizeKrTicker } from "@/lib/infer-sector";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
/** SEC fair-access UA (D7). Placeholder only when SEC_USER_AGENT is unset. */
const secUa = () => process.env.SEC_USER_AGENT?.trim() || "KoreaEquityDesk research@example.com";

const cache = new Map<string, { at: number; data: ValuationPack }>();
const CACHE_REV = "us-street-5";
const TTL_OK_MS = 6 * 60 * 60 * 1000;
const TTL_EMPTY_MS = 10 * 60 * 1000;
let tickerMap: Map<string, number> | null = null;

function cookieHeader(headers: Headers): string {
  const list = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  if (list.length) return list.map((c) => c.split(";")[0]).join("; ");
  const raw = headers.get("set-cookie");
  if (!raw) return "";
  return raw
    .split(/,(?=[^;,]+=)/)
    .map((c) => c.split(";")[0]!.trim())
    .filter(Boolean)
    .join("; ");
}

async function getText(url: string, headers: HeadersInit): Promise<{ res: Response; text: string } | null> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
    const text = await res.text();
    return { res, text };
  } catch {
    return null;
  }
}

async function postRatios(
  code: string,
  enc: string,
  cookie: string,
  rpt: string,
): Promise<unknown> {
  const pageUrl = `https://navercomp.wisereport.co.kr/v2/company/c1040001.aspx?cmp_cd=${code}`;
  const body = new URLSearchParams({
    cmp_cd: code,
    finGubun: "IFRSL",
    freq: "Y",
    frq: "Y",
    frqTyp: "0",
    rpt,
    cn: "",
    encparam: enc,
  });
  try {
    const res = await fetch("https://navercomp.wisereport.co.kr/v2/company/cF4002.aspx", {
      method: "POST",
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Referer: pageUrl,
        Cookie: cookie,
      },
      body,
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

async function fetchYahooWeekly(symbol: string): Promise<{ prices: MonthPrice[]; splits: SplitEvent[] }> {
  for (const host of ["query1", "query2"]) {
    const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1wk&range=10y&includeAdjustedClose=true&events=split`;
    const got = await getText(url, {
      "User-Agent": UA,
      Accept: "application/json",
    });
    if (!got || got.res.status === 429) continue;
    try {
      const json = JSON.parse(got.text);
      const prices = parseYahooAdjCloses(json);
      if (prices.length >= 8) return { prices, splits: parseYahooSplits(json) };
    } catch {
      /* next host */
    }
  }
  return { prices: [], splits: [] };
}

async function fetchKrWeeks(code: string): Promise<{ prices: MonthPrice[]; symbol: string | null }> {
  for (const suffix of [".KS", ".KQ"]) {
    const symbol = `${code}${suffix}`;
    const { prices } = await fetchYahooWeekly(symbol);
    if (prices.length >= 8) return { prices, symbol };
  }
  return { prices: [], symbol: null };
}

const KR_NOTE =
  "주가: Yahoo 수정주가 주봉(최대 10년). 재무: 네이버 컴퍼니가이드 IFRS 연결 연간(제공 구간, 보통 약 5개년). 금융감독원 OpenDART 재무 API는 인증키가 없으면 거부되어 호출하지 않는다. 후행 배수는 결산월부터 적용(공시 시차 미반영). 선행 PER은 최신 컨센서스 EPS이며 과거 컨센서스가 아니다. EPS≤0이면 PER 없음, EBITDA≤0이면 EV/EBITDA 없음. 배수를 추정해 채우지 않는다.";

async function loadKorea(code: string): Promise<ValuationPack> {
  const pageUrl = `https://navercomp.wisereport.co.kr/v2/company/c1040001.aspx?cmp_cd=${code}`;
  const [page, weeks] = await Promise.all([
    getText(pageUrl, {
      "User-Agent": UA,
      Accept: "text/html",
      Referer: "https://finance.naver.com/",
    }),
    fetchKrWeeks(code),
  ]);
  if (!page) {
    return emptyValuationPack(code, "컴퍼니가이드에 연결하지 못했습니다.");
  }
  if (/\/ETF\//i.test(page.res.url)) {
    return emptyValuationPack(
      code,
      "ETF는 기업 PER·EV 시계열이 없습니다. 배수를 추정하지 않습니다.",
    );
  }
  const enc = extractEncparam(page.text);
  if (!enc) {
    return emptyValuationPack(code, "컴퍼니가이드 지표 키(encparam)를 읽지 못했습니다.");
  }
  const cookie = cookieHeader(page.res.headers);
  const [rpt5, rpt0, bandGot] = await Promise.all([
    postRatios(code, enc, cookie, "5"),
    postRatios(code, enc, cookie, "0"),
    getText(
      `https://navercomp.wisereport.co.kr/v2/common/BandChart3.aspx?cmp_cd=${code}&gubun=4`,
      {
        "User-Agent": UA,
        Accept: "application/json, text/javascript, */*",
        Referer: pageUrl,
        Cookie: cookie,
      },
    ),
  ]);
  const { annuals, consensus } = parseAnnualFundamentals(rpt5, rpt0);
  let bandMonths: MonthPrice[] = [];
  if (bandGot) {
    try {
      bandMonths = parseBandMonthPrices(JSON.parse(bandGot.text));
    } catch {
      bandMonths = [];
    }
  }
  const months = weeks.prices.length >= 8 ? weeks.prices : bandMonths;
  if (!annuals.length || !months.length) {
    return emptyValuationPack(
      code,
      "연간 재무 또는 주가 시계열을 확인하지 못했습니다. 배수를 만들지 않습니다.",
    );
  }
  return buildValuationPack({
    code,
    annuals,
    consensus,
    months,
    source: weeks.prices.length >= 8 ? "yahoo-weekly+naver-companyguide" : "naver-companyguide",
    sourceUrl: pageUrl,
    note: weeks.prices.length >= 8
      ? KR_NOTE
      : "Yahoo 주봉을 받지 못해 컴퍼니가이드 월별 밴드 주가를 사용한다. " + KR_NOTE,
    currency: "KRW",
  });
}

async function loadTickerMap(): Promise<Map<string, number>> {
  if (tickerMap) return tickerMap;
  const got = await getText("https://www.sec.gov/files/company_tickers.json", {
    "User-Agent": secUa(),
    Accept: "application/json",
  });
  const map = new Map<string, number>();
  if (got) {
    try {
      const json = JSON.parse(got.text) as Record<string, { ticker?: string; cik_str?: number }>;
      for (const row of Object.values(json)) {
        if (row?.ticker && row.cik_str) map.set(row.ticker.toUpperCase(), row.cik_str);
      }
    } catch {
      /* empty map */
    }
  }
  tickerMap = map;
  return map;
}

async function loadUsName(symbol: string): Promise<string | null> {
  for (const suffix of [".O", ".N", ".A"]) {
    const got = await getText(`https://api.stock.naver.com/stock/${symbol}${suffix}/basic`, {
      "User-Agent": UA,
      Accept: "application/json",
      Referer: "https://m.stock.naver.com/",
    });
    if (!got) continue;
    try {
      const json = JSON.parse(got.text) as { stockName?: string };
      if (json.stockName) return json.stockName;
    } catch {
      /* next suffix */
    }
  }
  return null;
}

const US_NOTE =
  "주가: Yahoo 수정주가 주봉(최대 10년, 분할 반영). 주식수는 같은 분할 기준으로 맞춘다. 재무: SEC EDGAR companyfacts 10-Q/10-K. TTM은 최근 4개 분기 합이고, 4분기가 별도 태그로 없으면 연간−3분기로 만든다. 매출·EPS·감가상각은 가장 최근까지 이어지는 XBRL 태그를 쓴다. 적용 시점은 최초 제출일이다. EBITDA = 영업이익 + 감가상각(둘 다 있을 때만). EV = 시가총액 + 이자부 부채 − 현금. 둘 중 하나라도 공시에 없으면 EV 배수는 비운다. 선행 PER은 Nasdaq 최신 컨센서스(다음 4분기 합, 없으면 다음 회계연도)이며 과거 컨센서스가 아니다. EPS≤0이면 PER 없음. 배수를 추정해 채우지 않는다.";

async function fetchNasdaqConsensus(symbol: string): Promise<ConsensusEps | null> {
  const got = await getText(
    `https://api.nasdaq.com/api/analyst/${encodeURIComponent(symbol)}/earnings-forecast`,
    {
      "User-Agent": UA,
      Accept: "application/json, text/plain, */*",
      Origin: "https://www.nasdaq.com",
      Referer: "https://www.nasdaq.com/",
    },
  );
  if (!got || !got.res.ok) return null;
  try {
    return parseNasdaqEarningsForecast(JSON.parse(got.text));
  } catch {
    return null;
  }
}

async function loadUs(symbol: string): Promise<ValuationPack> {
  const [map, weekly, koName, consensus] = await Promise.all([
    loadTickerMap(),
    fetchYahooWeekly(symbol),
    loadUsName(symbol),
    fetchNasdaqConsensus(symbol),
  ]);
  const prices = weekly.prices;
  const cik = map.get(symbol);
  if (!cik) {
    return emptyValuationPack(
      symbol,
      `${symbol} 는 SEC 티커 목록에 없습니다. 미국 보통주가 아니면 PER을 만들지 않습니다.`,
    );
  }
  if (prices.length < 8) {
    return emptyValuationPack(symbol, `${symbol} 주가 시계열을 받지 못했습니다.`);
  }
  const cikText = String(cik).padStart(10, "0");
  const got = await getText(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cikText}.json`, {
    "User-Agent": secUa(),
    Accept: "application/json",
  });
  if (!got) {
    return emptyValuationPack(symbol, "SEC companyfacts 를 받지 못했습니다.");
  }
  let parsed: ReturnType<typeof annualsFromCompanyFacts>;
  try {
    parsed = annualsFromCompanyFacts(JSON.parse(got.text));
  } catch {
    return emptyValuationPack(symbol, "SEC 재무 JSON을 해석하지 못했습니다.");
  }
  if (!parsed.annuals.length) {
    return emptyValuationPack(symbol, "SEC 제출 서류에서 TTM EPS를 만들지 못했습니다.");
  }
  if (weekly.splits.length) {
    for (const row of parsed.annuals) {
      row.shares = sharesOnPriceBasis(row.shares, row.periodEnd, weekly.splits);
    }
  }
  return buildValuationPack({
    code: symbol,
    annuals: parsed.annuals,
    consensus,
    months: prices,
    source: "sec-edgar+yahoo-weekly",
    sourceUrl: `https://www.sec.gov/edgar/browse/?CIK=${cik}`,
    note: US_NOTE,
    name: koName ?? parsed.name,
    currency: "USD",
  });
}

export async function fetchValuationSeries(raw: string): Promise<ValuationPack> {
  const us = yahooUsSymbol(raw);
  const code = us ?? normalizeKrTicker(raw);
  const key = `${CACHE_REV}:${code}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit) {
    const ok = hit.data.per.stats.n > 0 || hit.data.evSales.stats.n > 0;
    if (now - hit.at < (ok ? TTL_OK_MS : TTL_EMPTY_MS)) return hit.data;
  }
  try {
    const data = us
      ? await loadUs(us)
      : /^[0-9A-Z]{6}$/.test(code)
        ? await loadKorea(code)
        : emptyValuationPack(code, "종목 코드를 해석하지 못했습니다.");
    cache.set(key, { at: now, data });
    return data;
  } catch {
    const empty = emptyValuationPack(code, "투자지표를 불러오지 못했습니다.");
    cache.set(key, { at: now, data: empty });
    return empty;
  }
}
