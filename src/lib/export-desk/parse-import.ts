export type ImporterId =
  | "MTI_MONTHLY_EXPORT"
  | "HS_MONTHLY_EXPORT"
  | "MTI_TAXONOMY"
  | "HSK_MTI_CROSSWALK"
  | "REGIONAL_EXPORT"
  | "KOSPI_INDEX_DAILY"
  | "KOSPI_STOCK_DAILY"
  | "LISTED_SECURITY_MASTER"
  | "FX_USDKRW_DAILY";

export interface TradeObservation {
  period: string;
  categoryId: string;
  categoryName?: string;
  valueUsd: number;
  classification: "MTI" | "HS" | "HSK" | "TOTAL";
  geo?: string;
  workingDays?: number;
  vintage?: string;
  releasedAt?: string;
  sourceFile: string;
}

export interface ValidationIssue {
  row: number;
  message: string;
}

export interface ImportResult {
  ok: boolean;
  importer: ImporterId;
  rows: TradeObservation[];
  issues: ValidationIssue[];
  filename: string;
  importedAt: string;
}

export function parsePeriod(raw: string): string | null {
  const s = String(raw ?? "").trim();
  for (const re of [
    /^(\d{4})(0[1-9]|1[0-2])$/,
    /^(\d{4})[-./](0?[1-9]|1[0-2])$/,
    /^(\d{4})년\s*(0?[1-9]|1[0-2])월$/,
  ]) {
    const m = s.match(re);
    if (m && Number(m[1]) > 0) return `${m[1]}-${String(m[2]).padStart(2, "0")}`;
  }
  return null;
}

/** Only explicitly supported USD scales may change a raw dollar amount. */
function usdUnitFactor(hint: string): number | null {
  const u = hint.toLowerCase().replace(/\s+/g, "");
  if (/krw|won|eur|euro|jpy|cny|원|엔|위안|유로|톤|킬로|kg|수량|중량|%|percent/.test(u))
    return null;
  const koreanScales: Record<string, number> = {
    천: 1_000,
    만: 10_000,
    백만: 1_000_000,
    억: 100_000_000,
  };
  // Match the entire scale so "천만달러" cannot be mistaken for "만달러".
  const scales = [...u.matchAll(/([조억만천백십]+)(?:달러|불|usd)/g)];
  if (
    scales.some((match) => koreanScales[match[1]!] == null) ||
    /\d[조억만천백십]+(?:달러|불|usd)/.test(u)
  )
    return null;
  const factors = new Set<number>();
  for (const match of scales) factors.add(koreanScales[match[1]!]!);
  if (/thousand|1000usd/.test(u)) factors.add(1_000);
  if (/million/.test(u)) factors.add(1_000_000);
  if (/billion/.test(u)) factors.add(1_000_000_000);
  if (/trillion|quadrillion/.test(u)) return null;
  return factors.size > 1 ? null : ([...factors][0] ?? 1);
}

export function parseKoreanNumber(raw: string, unitHint?: string): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s || /^(?:-|n\/?a|nan|null|\.)$/i.test(s)) return null;
  const accountingNegative = /^\(.*\)$/.test(s);
  if (accountingNegative) s = s.slice(1, -1).trim();
  if (accountingNegative && /^[+-]/.test(s)) return null;
  // Do not strip arbitrary text: "not available" and "12abc34" are not zero
  // or 1,234 dollars. Commas must be actual thousands separators.
  const m = s.match(
    /^\$?\s*([+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*(.*?)$/,
  );
  if (!m) return null;
  const suffix = m[2]!.toLowerCase().replace(/[\s.]/g, "");
  if (
    suffix &&
    !/^(?:(?:천|백만|만|억)?(?:달러|불|usd)|(?:thousand|million|billion)?(?:usd|us\$|usdollars?|dollars?)|thousand|million|billion|\$)$/i.test(
      suffix,
    )
  )
    return null;
  const n = Number(m[1]!.replace(/,/g, "")) * (accountingNegative ? -1 : 1);
  if (!Number.isFinite(n)) return null;
  const hintFactor = usdUnitFactor(unitHint ?? "");
  const suffixFactor = usdUnitFactor(suffix);
  if (
    hintFactor == null ||
    suffixFactor == null ||
    (hintFactor !== 1 && suffixFactor !== 1 && hintFactor !== suffixFactor)
  )
    return null;
  const value = n * (suffixFactor !== 1 ? suffixFactor : hintFactor);
  return Number.isFinite(value) ? value : null;
}

const HEADER_ALIASES: Record<string, string[]> = {
  period: ["기간", "년월", "period", "date", "yyyymm", "월", "기준년월"],
  value: ["수출액", "수출", "export", "value", "금액", "usd", "수출금액"],
  category: ["품목", "품목명", "item", "category", "mti", "hs", "코드명"],
  code: ["코드", "code", "mti코드", "hs코드", "품목코드"],
  geo: ["지역", "시도", "국가", "region", "sido", "country"],
  workingDays: ["가동일", "조업일수", "workingdays", "일수"],
};

function normHeader(h: string): string {
  return h.replace(/\s+/g, "").toLowerCase();
}

export function detectColumns(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    let bestScore = 0;
    headers.forEach((h, i) => {
      const n = normHeader(h);
      const isCode = /코드|code/.test(n);
      if (field === "value" && (isCode || /증감|비중|growth|share|rate|quantity|수량|중량/.test(n)))
        return;
      if (field === "category" && isCode && !/코드명|name/.test(n)) return;
      for (const alias of aliases.map(normHeader)) {
        const score =
          n === alias
            ? 1000 + alias.length
            : alias.length > 1 && n.includes(alias)
              ? alias.length
              : 0;
        if (score > bestScore) {
          map[field] = i;
          bestScore = score;
        }
      }
    });
  }
  return map;
}

export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const table: string[][] = [];
  let row: string[] = [],
    cur = "",
    quoted = false,
    closed = false;
  const field = () => {
    row.push(cur.trim());
    cur = "";
    closed = false;
  };
  const record = () => {
    field();
    if (row.some((cell) => cell.length)) table.push(row);
    row = [];
  };
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!;
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
        closed = true;
      } else cur += ch;
      continue;
    }
    if (ch === ",") field();
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && source[i + 1] === "\n") i++;
      record();
    } else if (ch === '"' && !closed && !cur.trim()) {
      cur = "";
      quoted = true;
    } else if ((closed && ch.trim()) || ch === '"') throw new Error("CSV 따옴표 형식 오류");
    else if (!closed) cur += ch;
  }
  if (quoted) throw new Error("CSV 따옴표가 닫히지 않았습니다.");
  if (cur.length || row.length || closed) record();
  return table;
}

export function importTradeCsv(text: string, filename: string, importer: ImporterId): ImportResult {
  const importedAt = new Date().toISOString();
  if (!["MTI_MONTHLY_EXPORT", "HS_MONTHLY_EXPORT", "REGIONAL_EXPORT"].includes(importer)) {
    return {
      ok: false,
      importer,
      rows: [],
      issues: [
        {
          row: 0,
          message:
            "이 파일 유형은 월별 수출액 CSV로 가져올 수 없습니다. 전용 가져오기가 필요합니다.",
        },
      ],
      filename,
      importedAt,
    };
  }
  let table: string[][];
  try {
    table = parseCsv(text);
  } catch (e) {
    return {
      ok: false,
      importer,
      rows: [],
      issues: [{ row: 0, message: e instanceof Error ? e.message : "CSV 파싱 오류" }],
      filename,
      importedAt,
    };
  }
  const issues: ValidationIssue[] = [];
  if (table.length < 2) {
    return {
      ok: false,
      importer,
      rows: [],
      issues: [{ row: 0, message: "헤더+데이터 행이 필요합니다." }],
      filename,
      importedAt: new Date().toISOString(),
    };
  }
  const headers = table[0]!;
  const cols = detectColumns(headers);
  if (cols.period == null || cols.value == null) {
    return {
      ok: false,
      importer,
      rows: [],
      issues: [
        {
          row: 0,
          message: `필수 열 없음 (기간/수출액). 감지된 헤더: ${headers.join(", ")}`,
        },
      ],
      filename,
      importedAt: new Date().toISOString(),
    };
  }
  const unitHint = headers[cols.value]!;
  const classification =
    importer === "HS_MONTHLY_EXPORT" ? "HS" : importer === "MTI_MONTHLY_EXPORT" ? "MTI" : "TOTAL";
  const rows: TradeObservation[] = [];
  const seen = new Map<string, number>();
  const conflicts = new Set<string>();
  for (let i = 1; i < table.length; i++) {
    const rec = table[i]!;
    const period = parsePeriod(rec[cols.period] ?? "");
    const valueUsd = parseKoreanNumber(rec[cols.value] ?? "", unitHint);
    if (!period) {
      issues.push({ row: i + 1, message: `기간 파싱 실패: ${rec[cols.period]}` });
      continue;
    }
    if (valueUsd == null) {
      issues.push({ row: i + 1, message: `금액 파싱 실패: ${rec[cols.value]}` });
      continue;
    }
    if (valueUsd < 0) {
      issues.push({ row: i + 1, message: "음수 수출액은 거부합니다." });
      continue;
    }
    const categoryId =
      (cols.code != null ? rec[cols.code] : undefined) ||
      (cols.category != null ? rec[cols.category] : undefined) ||
      "TOTAL";
    const geo = cols.geo != null ? rec[cols.geo]?.trim() : undefined;
    const key = JSON.stringify([period, categoryId, classification, geo ?? ""]);
    const previous = seen.get(key);
    if (previous != null) {
      if (previous !== valueUsd) {
        conflicts.add(key);
        issues.push({
          row: i + 1,
          message: "동일 기간·품목·지역의 수출액이 상충합니다. 해당 관측은 제외합니다.",
        });
      }
      continue;
    }
    seen.set(key, valueUsd);
    const wd =
      cols.workingDays == null
        ? null
        : String(rec[cols.workingDays] ?? "")
            .trim()
            .match(/^(\d+(?:\.\d+)?)\s*일?$/);
    const workingDays = wd ? Number(wd[1]) : undefined;
    rows.push({
      period,
      categoryId: String(categoryId),
      categoryName: cols.category != null ? rec[cols.category] : categoryId,
      valueUsd,
      classification,
      geo,
      workingDays:
        workingDays != null && workingDays > 0 && workingDays <= 31 ? workingDays : undefined,
      vintage: new Date().toISOString().slice(0, 10),
      sourceFile: filename,
    });
  }
  const accepted = rows.filter(
    (row) =>
      !conflicts.has(
        JSON.stringify([row.period, row.categoryId, row.classification, row.geo ?? ""]),
      ),
  );
  if (accepted.length === 0) {
    return {
      ok: false,
      importer,
      rows: [],
      issues: issues.length ? issues : [{ row: 0, message: "유효 행이 없습니다." }],
      filename,
      importedAt: new Date().toISOString(),
    };
  }
  return {
    ok: true,
    importer,
    rows: accepted,
    issues,
    filename,
    importedAt: new Date().toISOString(),
  };
}

export interface IndexDailyRow {
  date: string;
  close: number;
  sourceFile: string;
}

export function importIndexCsv(
  text: string,
  filename: string,
): {
  ok: boolean;
  rows: IndexDailyRow[];
  issues: ValidationIssue[];
} {
  let table: string[][];
  try {
    table = parseCsv(text);
  } catch (e) {
    return {
      ok: false,
      rows: [],
      issues: [{ row: 0, message: e instanceof Error ? e.message : "CSV 파싱 오류" }],
    };
  }
  if (table.length < 2) return { ok: false, rows: [], issues: [{ row: 0, message: "빈 파일" }] };
  const headers = table[0]!.map((h) => h.toLowerCase());
  const di = headers.findIndex((h) => /date|일자|날짜/.test(h));
  const ci = headers.findIndex((h) =>
    /close|종가|index|지수|환율|rate|usd.?krw|원.?달러|달러.?원/.test(h),
  );
  if (di < 0 || ci < 0) {
    return { ok: false, rows: [], issues: [{ row: 0, message: "일자/종가·환율 열 없음" }] };
  }
  const rows: IndexDailyRow[] = [];
  const issues: ValidationIssue[] = [];
  const byDate = new Map<string, number>();
  const conflicts = new Set<string>();
  for (let i = 1; i < table.length; i++) {
    const dateRaw = (table[i]![di] ?? "").trim();
    const parts =
      dateRaw.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/) ??
      dateRaw.match(/^(\d{4})(\d{2})(\d{2})$/);
    const date = parts
      ? `${parts[1]}-${parts[2]!.padStart(2, "0")}-${parts[3]!.padStart(2, "0")}`
      : "";
    const parsed = new Date(`${date}T00:00:00.000Z`);
    const rawClose = String(table[i]![ci] ?? "").trim();
    const validClose = /^[+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(rawClose);
    const close = validClose ? Number(rawClose.replace(/,/g, "")) : NaN;
    if (
      !date ||
      date.startsWith("0000") ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date ||
      !Number.isFinite(close) ||
      close <= 0
    ) {
      issues.push({ row: i + 1, message: "일자/종가 파싱 실패" });
      continue;
    }
    const previous = byDate.get(date);
    if (previous != null) {
      if (previous !== close) {
        conflicts.add(date);
        issues.push({
          row: i + 1,
          message: "동일 일자의 종가가 상충합니다. 해당 일자는 제외합니다.",
        });
      }
      continue;
    }
    byDate.set(date, close);
    rows.push({ date, close, sourceFile: filename });
  }
  const accepted = rows
    .filter((row) => !conflicts.has(row.date))
    .sort((a, b) => a.date.localeCompare(b.date)); // ked-allow-string-date-sort: single-format time series; validated ISO calendar dates
  return { ok: accepted.length > 0, rows: accepted, issues };
}
