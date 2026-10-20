/**
 * KRX-linked disclosure desk
 *
 * Source map (how brokers also get data):
 * 1) KIND (kind.krx.co.kr) — KRX official listed-company disclosure portal
 * 2) DART (dart.fss.or.kr) — FSS electronic filings (statutory reports)
 * 3) Naver stock disclosure feed — redistributes KRX/KOSCOM market notices
 *
 * KIND is attempted first for "today" feed; when KIND is unavailable from this
 * environment we still ship DART + KOSCOM (Naver) with honest source labels.
 */
import { sortDisclosuresNewestFirst } from "@/lib/feed/mappers";
import { UNIVERSE } from "@/data/universe";
import { decodeHtmlEntities } from "@/lib/readable-text";
import { isOpenDartConnected, type OpenDartStatus } from "@/lib/opendart-status";
import { fetchOpenDartDisclosures, type OpenDartDisclosure } from "./opendart";

const UA = "Mozilla/5.0 (compatible; KoreaEquityCommand/1.0; +https://x.ai) AppleWebKit/537.36";

function headers(extra?: HeadersInit): HeadersInit {
  return {
    "User-Agent": UA,
    Accept: "text/html,application/json,application/xhtml+xml,*/*",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    ...extra,
  };
}

async function getText(url: string, extra?: HeadersInit): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 22_000);
  try {
    const res = await fetch(url, {
      headers: headers(extra),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

async function postForm(url: string, body: string, extra?: HeadersInit): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 22_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: headers({
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        ...extra,
      }),
      body,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function decodeEntities(s: string): string {
  return decodeHtmlEntities(s);
}

function kstYmd(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function stripTags(s: string): string {
  return decodeEntities(
    s
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

export type DisclosureSource = "kind-krx" | "dart-fss" | "krx-koscom" | "naver-disclosure";

export interface KrxDisclosureItem {
  id: string;
  title: string;
  datetime: string;
  author: string;
  code?: string;
  nameKo?: string;
  market?: string;
  rcpNo?: string;
  acptNo?: string;
  corpCode?: string;
  source: DisclosureSource;
  sourceLabel: string;
  dartUrl?: string;
  kindUrl?: string;
  dartSearchUrl: string;
  canLoadBody: boolean;
}

export function dartViewerUrl(rcpNo: string): string {
  return `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rcpNo}`;
}

export function dartSearchUrl(nameOrCode: string): string {
  return `https://dart.fss.or.kr/dsab001/main.do?autoSearch=Y&textCrpNm=${encodeURIComponent(nameOrCode)}`;
}

export function kindViewerUrl(acptNo: string): string {
  return `https://kind.krx.co.kr/common/disclsviewer.do?method=search&acptno=${acptNo}`;
}

export function kindTodayUrl(): string {
  return "https://kind.krx.co.kr/disclosure/todaydisclosure.do";
}

const SOURCE_LABEL: Record<DisclosureSource, string> = {
  "kind-krx": "KRX KIND",
  "dart-fss": "DART(금감원)",
  "krx-koscom": "KRX·KOSCOM",
  "naver-disclosure": "네이버 공시",
};

function toIsoDateTime(date: string, time?: string): string {
  // date: 2026.08.10 or 2026-08-10. Without a time the value stays date-only
  // (`YYYY-MM-DD`) so no fake 00:00 is ever displayed or sorted on.
  const d = date.replace(/\./g, "-");
  if (!time || !/^\d{2}:\d{2}/.test(time)) return d;
  const tm = time.length === 5 ? `${time}:00` : time.slice(0, 8);
  return `${d}T${tm}+09:00`;
}

function mapNameToCode(name?: string): string | undefined {
  if (!name) return undefined;
  const n = name.trim();
  const hit = UNIVERSE.find(
    (u) => u.nameKo === n || u.nameKo.replace(/\s/g, "") === n.replace(/\s/g, ""),
  );
  return hit?.code;
}

// ── KIND (KRX) ────────────────────────────────────────────────────────────

export async function fetchKindStatus(): Promise<{
  available: boolean;
  message: string;
  url: string;
}> {
  try {
    const html = await getText("https://kind.krx.co.kr/main.do", {
      Referer: "https://kind.krx.co.kr/",
    });
    if (html.includes("페이지 오류") || html.includes("잠시 후 다시") || html.length < 3000) {
      return {
        available: false,
        message:
          "KIND(한국거래소 공시) 포털이 현재 점검/차단 상태입니다. DART·KOSCOM 피드로 대체합니다.",
        url: kindTodayUrl(),
      };
    }
    return {
      available: true,
      message: "KIND 연결 가능",
      url: kindTodayUrl(),
    };
  } catch (e) {
    return {
      available: false,
      message: `KIND 연결 실패: ${e instanceof Error ? e.message : "network"}`,
      url: kindTodayUrl(),
    };
  }
}

/**
 * Attempt KIND today-disclosure search.
 * Returns empty list when KIND is unavailable (common from cloud IPs).
 */
export async function fetchKindTodayDisclosures(): Promise<{
  items: KrxDisclosureItem[];
  available: boolean;
  message: string;
}> {
  const status = await fetchKindStatus();
  if (!status.available) {
    return { items: [], available: false, message: status.message };
  }

  try {
    // Standard KIND form used by portal "금일공시"
    const body = [
      "method=searchTodayDisclosure",
      "currentPageSize=30",
      "pageIndex=1",
      "orderMode=0",
      "orderStat=D",
      "forward=todaydisclosure_sub",
      "chose=S",
      "todayFlag=Y",
    ].join("&");
    const html = await postForm("https://kind.krx.co.kr/disclosure/todaydisclosure.do", body, {
      Referer: kindTodayUrl(),
      Origin: "https://kind.krx.co.kr",
    });

    if (html.includes("페이지 오류") || html.length < 2000) {
      return {
        items: [],
        available: false,
        message: status.message,
      };
    }

    const items: KrxDisclosureItem[] = [];
    for (const tr of html.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
      const acpt =
        tr.match(/acptno=(\d{14})/i)?.[1] ?? tr.match(/openDisclsViewer\(['"]?(\d{14})/i)?.[1];
      const title =
        stripTags(
          tr.match(/class=['"][^"]*first[^"]*['"][^>]*>([\s\S]*?)<\//i)?.[1] ??
            tr.match(/<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ??
            "",
        ) || "";
      if (!title || title.length < 2) continue;
      const company = stripTags(
        tr.match(/class=['"][^"]*second[^"]*['"][^>]*>([\s\S]*?)<\//i)?.[1] ?? "",
      );
      const time = tr.match(/(\d{2}:\d{2}(?::\d{2})?)/)?.[1];
      const today = kstYmd();
      const code = mapNameToCode(company);
      items.push({
        id: `kind-${acpt ?? items.length}-${title.slice(0, 20)}`,
        title,
        datetime: toIsoDateTime(today.replace(/-/g, "."), time),
        author: "KIND",
        code,
        nameKo: company || undefined,
        acptNo: acpt,
        source: "kind-krx",
        sourceLabel: SOURCE_LABEL["kind-krx"],
        kindUrl: acpt ? kindViewerUrl(acpt) : kindTodayUrl(),
        dartSearchUrl: dartSearchUrl(company || " "),
        canLoadBody: false,
      });
    }

    return {
      items: items.slice(0, 40),
      available: true,
      message: `KIND 금일 공시 ${items.length}건`,
    };
  } catch (e) {
    return {
      items: [],
      available: false,
      message: `KIND 조회 실패: ${e instanceof Error ? e.message : "error"}`,
    };
  }
}

// ── DART (FSS) ────────────────────────────────────────────────────────────

function parseDartTableRows(html: string): KrxDisclosureItem[] {
  const items: KrxDisclosureItem[] = [];
  const seen = new Set<string>();

  for (const tr of html.match(/<tr>([\s\S]*?)<\/tr>/gi) ?? []) {
    const rcp = tr.match(/rcpNo=(\d{14})/)?.[1];
    if (!rcp || seen.has(rcp)) continue;
    seen.add(rcp);

    const dateM = tr.match(/webOnly">(\d{4}\.\d{2}\.\d{2})<\/span>\s*(\d{2}:\d{2})/);
    const market = tr.match(/webOnly">(유가증권시장|코스닥시장|코넥스시장|기타법인)<\/span>/)?.[1];
    const corp = tr.match(/openCorpInfoNew\(['"](\d+)['"][\s\S]*?>\s*([^<\n]+)/);
    const titleM =
      tr.match(/rcpNo=\d{14}[^"]*"[^>]*>([\s\S]*?)<\/a>/) ??
      tr.match(/openReportViewer(?:Main)?\(['"]\d+['"]\);[^>]*>([\s\S]*?)<\/a>/);
    const title = stripTags(titleM?.[1] ?? "");
    if (!title) continue;

    const nameKo = corp?.[2]?.trim();
    const code = mapNameToCode(nameKo);
    const date = dateM?.[1] ?? "";
    const time = dateM?.[2];

    items.push({
      id: `dart-${rcp}`,
      title,
      // Unknown date stays empty (sorted last, shown as 날짜 미상) — never "now".
      datetime: date ? toIsoDateTime(date, time) : "",
      author: "DART",
      code,
      nameKo,
      market,
      rcpNo: rcp,
      corpCode: corp?.[1],
      source: "dart-fss",
      sourceLabel: SOURCE_LABEL["dart-fss"],
      dartUrl: dartViewerUrl(rcp),
      dartSearchUrl: dartSearchUrl(nameKo ?? rcp),
      canLoadBody: false,
    });
  }
  return items;
}

/** Legacy public HTML is only used when the official API is unavailable. */
async function fetchDartRecentMarketHtml(): Promise<KrxDisclosureItem[]> {
  const html = await getText("https://dart.fss.or.kr/main.do", {
    Referer: "https://dart.fss.or.kr/",
  });
  const idx = html.indexOf("최근공시");
  const chunk = idx >= 0 ? html.slice(idx, idx + 100_000) : html;
  return parseDartTableRows(chunk).slice(0, 60);
}

/** Legacy name search; results are filtered again before use as a fallback. */
async function fetchDartByCompanyHtml(nameKo: string, days = 90): Promise<KrxDisclosureItem[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const fmt = kstYmd;
  const body = new URLSearchParams({
    currentPage: "1",
    maxResults: "30",
    maxLinks: "10",
    sort: "date",
    series: "desc",
    textCrpNm: nameKo,
    startDate: fmt(start),
    endDate: fmt(end),
  }).toString();

  const html = await postForm("https://dart.fss.or.kr/dsab001/search.ax", body, {
    Referer: "https://dart.fss.or.kr/dsab001/main.do",
    Origin: "https://dart.fss.or.kr",
  });
  return parseDartTableRows(html);
}

/** Preserve the API's receipt date precision; OpenDART does not supply a time. */
export function mapOpenDartDisclosure(row: OpenDartDisclosure): KrxDisclosureItem {
  return {
    id: `dart-${row.receiptNo}`,
    title: row.reportName,
    datetime: row.receiptDate,
    author: row.submitter || "금융감독원",
    code: row.stockCode,
    nameKo: row.corpName,
    market: { Y: "KOSPI", K: "KOSDAQ", N: "KONEX", E: "기타" }[row.market],
    rcpNo: row.receiptNo,
    corpCode: row.corpCode,
    source: "dart-fss",
    sourceLabel: "OpenDART(금감원)",
    dartUrl: dartViewerUrl(row.receiptNo),
    dartSearchUrl: dartSearchUrl(row.corpName),
    canLoadBody: false,
  };
}

async function fetchDartBundle(opts?: {
  stockCode?: string;
  nameKo?: string;
  days?: number;
}): Promise<{ items: KrxDisclosureItem[]; status: OpenDartStatus }> {
  const official = await fetchOpenDartDisclosures({
    stockCode: opts?.stockCode,
    days: opts?.days,
  });
  // A successful empty response is authoritative. Unknown company identities
  // must not fall through to a name search that could identify a different firm.
  if (
    isOpenDartConnected(official.status) ||
    official.status.state === "company-not-found" ||
    official.status.state === "invalid-request"
  ) {
    return { items: official.items.map(mapOpenDartDisclosure), status: official.status };
  }
  const name = opts?.nameKo;
  const items = await (
    opts?.stockCode
      ? name
        ? fetchDartByCompanyHtml(name, opts.days ?? 120).then((rows) =>
            rows.filter((row) => row.code === opts.stockCode && row.nameKo === name),
          )
        : Promise.resolve([] as KrxDisclosureItem[])
      : fetchDartRecentMarketHtml()
  ).catch(() => [] as KrxDisclosureItem[]);
  return {
    items: items.map((row) => ({ ...row, sourceLabel: "DART 웹페이지(대체)" })),
    status: { ...official.status, fallbackUsed: items.length > 0 },
  };
}

// ── KRX/KOSCOM via Naver disclosure API ───────────────────────────────────

type NaverRow = {
  itemCode?: string;
  disclosureId: number | string;
  title: string;
  datetime: string;
  author?: string;
};

export async function fetchKrxKoscomDisclosures(
  code: string,
  nameKo?: string,
  pageSize = 30,
): Promise<KrxDisclosureItem[]> {
  const res = await fetch(
    `https://m.stock.naver.com/api/stock/${code}/disclosure?pageSize=${pageSize}`,
    {
      headers: headers({
        Referer: `https://m.stock.naver.com/domestic/stock/${code}/total`,
        Accept: "application/json",
      }),
      signal: AbortSignal.timeout(12_000),
    },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = (await res.json()) as NaverRow[];
  const name = nameKo ?? UNIVERSE.find((u) => u.code === code)?.nameKo;

  return (rows ?? []).map((d) => {
    const author = d.author ?? "공시";
    const isKoscom = /KOSCOM|KRX|거래소/i.test(author);
    const source: DisclosureSource = isKoscom ? "krx-koscom" : "naver-disclosure";
    return {
      id: String(d.disclosureId),
      title: d.title,
      datetime: d.datetime,
      author,
      code: d.itemCode ?? code,
      nameKo: name,
      source,
      sourceLabel: SOURCE_LABEL[source],
      dartSearchUrl: dartSearchUrl(name ?? code),
      canLoadBody: true,
    } satisfies KrxDisclosureItem;
  });
}

// ── Aggregated desk ───────────────────────────────────────────────────────

/** Feed polling has a shorter budget than the full interactive desk. Keep
 * already available official data when another, optional source is slow. */
function withinSourceBudget<T>(
  operation: Promise<T>,
  budget: number | undefined,
  fallback: () => T,
): Promise<T> {
  if (budget === undefined) return operation;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback()), budget);
    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback());
      },
    );
  });
}

export async function fetchKrxDisclosureDesk(opts?: {
  scanCodes?: string[];
  sourceBudgetMs?: number;
}): Promise<{
  kind: {
    available: boolean;
    message: string;
    items: KrxDisclosureItem[];
    portalUrl: string;
  };
  dart: KrxDisclosureItem[];
  koscom: KrxDisclosureItem[];
  all: KrxDisclosureItem[];
  openDart: OpenDartStatus;
  fetchedAt: string;
}> {
  const scan = opts?.scanCodes ?? [
    "005930",
    "000660",
    "373220",
    "005380",
    "000270",
    "034020",
    "012450",
    "207940",
    "035420",
    "006400",
  ];
  const budget =
    opts?.sourceBudgetMs === undefined
      ? undefined
      : Math.max(1, Math.min(5_000, opts.sourceBudgetMs));

  const [kindPack, dartPack, koscomBundles] = await Promise.all([
    withinSourceBudget(fetchKindTodayDisclosures(), budget, () => ({
      available: false,
      items: [] as KrxDisclosureItem[],
      message: "공시 피드 조회 시간 내 KIND 응답을 확인하지 못했습니다.",
    })),
    withinSourceBudget(fetchDartBundle(), budget, () => ({
      items: [] as KrxDisclosureItem[],
      status: {
        configured: Boolean(process.env.OPENDART_API_KEY?.trim()),
        state: "unavailable" as const,
        message: "공시 피드 조회 시간 내 OpenDART 응답을 확인하지 못했습니다.",
        checkedAt: new Date().toISOString(),
        fallbackUsed: false,
      },
    })),
    Promise.all(
      scan.map(async (code) => {
        const name = UNIVERSE.find((u) => u.code === code)?.nameKo;
        try {
          return await withinSourceBudget(
            fetchKrxKoscomDisclosures(code, name, 8),
            budget,
            () => [] as KrxDisclosureItem[],
          );
        } catch {
          return [] as KrxDisclosureItem[];
        }
      }),
    ),
  ]);

  const koscom = sortDisclosuresNewestFirst(koscomBundles.flat()).slice(0, 80);
  const dart = dartPack.items;

  return {
    kind: {
      available: kindPack.available,
      message: kindPack.message,
      items: kindPack.items,
      portalUrl: kindTodayUrl(),
    },
    dart,
    koscom,
    openDart: dartPack.status,
    /** KIND + KOSCOM + DART merged, newest first via the shared kernel (D1e). */
    all: sortDisclosuresNewestFirst([...koscom, ...dart, ...kindPack.items]),
    fetchedAt: new Date().toISOString(),
  };
}

/** Merge KOSCOM + DART for a single stock. */
export async function fetchStockDisclosureBundle(
  code: string,
  nameKo?: string,
): Promise<{
  items: KrxDisclosureItem[];
  dart: KrxDisclosureItem[];
  koscom: KrxDisclosureItem[];
  kindStatus: Awaited<ReturnType<typeof fetchKindStatus>>;
  openDart: OpenDartStatus;
}> {
  const name = nameKo ?? UNIVERSE.find((u) => u.code === code)?.nameKo ?? code;
  const [koscom, dartPack, kindStatus] = await Promise.all([
    fetchKrxKoscomDisclosures(code, name).catch(() => [] as KrxDisclosureItem[]),
    fetchDartBundle({ stockCode: code, nameKo: name, days: 120 }),
    fetchKindStatus(),
  ]);

  const dart = dartPack.items;
  const items = sortDisclosuresNewestFirst([...koscom, ...dart]);

  return { items, dart, koscom, kindStatus, openDart: dartPack.status };
}
