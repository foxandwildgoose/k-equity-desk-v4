import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DATA_SOURCES } from "@/data/export-desk/dataSources.config";
import regionalCap from "@/data/export-desk/regionalCapability.config.json";
import { t } from "@/lib/export-desk/i18n";
import {
  assertNoSyntheticLeak,
  getCore20,
  getDemoExportSeries,
  useExportDeskStore,
} from "@/lib/export-desk/store";
import {
  calculateCrossCorrelation,
  calculateMomentum,
  calculatePartialCorrelation,
  calculatePearson,
  calculateRolling12MSum,
  calculateYoYGrowth,
  convertUsdKrw,
  fxRateForPeriod,
  calculateWorkingDayAdjusted,
  normalizeToBase100,
  pearsonWithInference,
  resampleDailyToMonthEnd,
  alignByReleaseDate,
} from "@/lib/export-desk/stats";
import {
  rankKospiByMarketCap,
  type RankableSecurity,
} from "@/lib/export-desk/ranking";
import {
  resolveCompanySectorExposure,
  validateTradeTotals,
  type CompanyExportExposure,
} from "@/lib/export-desk/exposure";
import { resolveRegionalCapability } from "@/lib/export-desk/taxonomy";
import { importTradeCsv, type ImporterId } from "@/lib/export-desk/parse-import";
import { useExportMacro, useIndustryMonthlyPrices, useKospiCapQuotes } from "@/lib/export-desk/use-macro";
import { useLiveTrade } from "@/lib/export-desk/use-live";
import { ExportAmountChart, ExportDualChart } from "@/components/export-desk/ExportDualChart";
import { ChartFrame } from "@/components/charts/core/ChartFrame";
import { chartExportName } from "@/lib/charts/tools";
import { hsName, proxyForKey } from "@/lib/export-desk/hs-map";
import type { TradeObservation } from "@/lib/export-desk/parse-import";
import { cn } from "@/lib/utils";
import { kstYmd } from "@/lib/format";
import { normalizeKrTicker } from "@/lib/infer-sector";
import {
  AlertTriangle,
  FileUp,
  Globe2,
  Info,
  Ship,
} from "lucide-react";

const TABS = [
  { id: "total", key: "export.total.title" },
  { id: "core20", key: "export.core20.title" },
  { id: "all", key: "export.all.title" },
  { id: "industry", key: "export.industry100.title" },
  { id: "corr", key: "export.corr.title" },
  { id: "region", key: "export.region.title" },
  { id: "qa", key: "export.qa.title" },
  { id: "admin", key: "export.admin.title" },
  { id: "import", key: "export.import.title" },
] as const;

function Provenance({
  source,
  period,
  ingested,
  taxonomy,
}: {
  source: string;
  period: string;
  ingested: string;
  taxonomy: string;
}) {
  const lang = useExportDeskStore((s) => s.lang);
  return (
    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
      <Badge variant="outline" className="text-[10px]">
        {t("export.provenance", lang)} · {source}
      </Badge>
      <span>기간 {period || "N/A"}</span>
      <span>수집 {ingested || "N/A"}</span>
      <span>
        {t("export.taxonomy.badge", lang)} {taxonomy}
      </span>
    </div>
  );
}

export function ExportDesk() {
  const lang = useExportDeskStore((s) => s.lang);
  const setLang = useExportDeskStore((s) => s.setLang);
  const demo = useExportDeskStore((s) => s.demoMode);
  const settings = useExportDeskStore((s) => s.settings);
  const patch = useExportDeskStore((s) => s.patchSettings);
  const [tab, setTab] = useState<string>("total");
  const [selectedCat, setSelectedCat] = useState("semiconductors");

  function openIndustry(cat: string) {
    setSelectedCat(cat);
    setTab("industry");
  }

  return (
    <div className="page-stack">
      {demo && (
        <div className="sticky top-0 z-20 rounded-md bg-desk-copper px-3 py-2 text-sm font-semibold text-black">
          {t("export.demo.banner", lang)}
        </div>
      )}
      <header className="page-header">
        <p className="desk-kicker mb-1.5">Trade statistics × listed equity</p>
        <h1 className="page-title flex items-center gap-2">
          <Ship className="size-7 text-desk-gold" />
          {t("export.desk.title", lang)}
        </h1>
        <p className="page-lead">
          총수출은 FRED/OECD 월별 공식 시계열, 품목은 UN Comtrade HS,
          시세는 거래소 스냅샷입니다. 데모 숫자가 기본값이 아닙니다.
        </p>
        <LiveTape />
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <label className="inline-flex items-center gap-1.5">
            <Switch checked={lang === "en"} onCheckedChange={(v) => setLang(v ? "en" : "ko")} />
            EN
          </label>
          <select
            className="h-8 rounded-md border border-border bg-background px-2"
            value={settings.range}
            onChange={(e) => patch({ range: e.target.value as typeof settings.range })}
          >
            {(["1Y", "3Y", "5Y", "10Y", "MAX"] as const).map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <select
            className="h-8 rounded-md border border-border bg-background px-2"
            value={settings.chartMode}
            onChange={(e) =>
              patch({ chartMode: e.target.value as typeof settings.chartMode })
            }
          >
            <option value="indexed">Indexed=100</option>
            <option value="absolute">Absolute</option>
            <option value="growth">Growth</option>
            <option value="krw">Export KRW</option>
          </select>
          <select
            className="h-8 rounded-md border border-border bg-background px-2"
            value={settings.levelSeries}
            onChange={(e) =>
              patch({ levelSeries: e.target.value as typeof settings.levelSeries })
            }
          >
            <option value="roll12">12M 누적 (기본)</option>
            <option value="wad">일평균</option>
            <option value="raw">원시계열 (계절성)</option>
          </select>
          <select
            className="h-8 rounded-md border border-border bg-background px-2"
            value={settings.universeN}
            onChange={(e) =>
              patch({ universeN: Number(e.target.value) as 100 | 200 })
            }
          >
            <option value={100}>Top 100</option>
            <option value={200}>Top 200</option>
          </select>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap justify-start">
          {TABS.map((tb) => (
            <TabsTrigger key={tb.id} value={tb.id} className="text-[11px]">
              {t(tb.key, lang)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="total">
          <TotalPanel />
        </TabsContent>
        <TabsContent value="core20">
          <Core20Panel onOpen={openIndustry} />
        </TabsContent>
        <TabsContent value="all">
          <AllIndustriesPanel onOpen={openIndustry} />
        </TabsContent>
        <TabsContent value="industry">
          <IndustryPanel cat={selectedCat} onCat={setSelectedCat} />
        </TabsContent>
        <TabsContent value="corr">
          <CorrPanel />
        </TabsContent>
        <TabsContent value="region">
          <RegionPanel />
        </TabsContent>
        <TabsContent value="qa">
          <QaPanel />
        </TabsContent>
        <TabsContent value="admin">
          <AdminPanel />
        </TabsContent>
        <TabsContent value="import">
          <ImportPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function useAllObservations(): TradeObservation[] {
  const imported = useExportDeskStore((s) => s.observations);
  const live = useLiveTrade();
  return useMemo(() => {
    const map = new Map<string, TradeObservation>();
    for (const o of live.data?.observations ?? []) {
      map.set(`${o.categoryId}|${o.period}`, o);
    }
    for (const o of imported) {
      map.set(`${o.categoryId}|${o.period}`, o);
    }
    return [...map.values()];
  }, [imported, live.data]);
}

function useExportSeries(categoryId = "TOTAL") {
  const demo = useExportDeskStore((s) => s.demoMode);
  const alignment = useExportDeskStore((s) => s.settings.alignment);
  const all = useAllObservations();
  return useMemo(() => {
    const real = all.filter((o) => o.categoryId === categoryId);
    const demoRows = getDemoExportSeries(demo).filter((o) => o.categoryId === categoryId);
    const used = real.length ? real : demo ? demoRows : [];
    if (!demo) assertNoSyntheticLeak(used, false);
    return alignByReleaseDate(
      [...used].sort((a, b) => a.period.localeCompare(b.period)),
      alignment,
    );
  }, [all, demo, categoryId, alignment]);
}

function LiveTape() {
  const live = useLiveTrade();
  const exports = useExportSeries("TOTAL");
  const values = exports.map((e) => e.valueUsd);
  const yoy = calculateYoYGrowth(values);
  const last = exports.at(-1);
  const prev = exports.at(-2);
  const y = yoy.at(-1);
  const mom =
    last && prev && prev.valueUsd
      ? ((last.valueUsd / prev.valueUsd - 1) * 100)
      : null;
  const roll = calculateRolling12MSum(values).at(-1);
  const imp = live.data?.imports ?? [];
  const matchedImp = last
    ? imp.find((i) => i.period === last.period)
    : undefined;
  const bal =
    last && matchedImp ? last.valueUsd - matchedImp.valueUsd : null;
  const macro = useExportMacro();
  const k = macro.data?.kospi.at(-1);
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <Kpi
        label="총수출 (FRED/OECD)"
        value={last ? formatUsdBn(last.valueUsd) : live.isLoading ? "수집 중" : "N/A"}
        sub={last?.period ?? "—"}
      />
      <Kpi
        label="YoY"
        value={y != null && Number.isFinite(y) ? `${y.toFixed(1)}%` : "N/A"}
        tone={y != null && y >= 0 ? "up" : "down"}
      />
      <Kpi
        label="MoM"
        value={mom != null && Number.isFinite(mom) ? `${mom.toFixed(1)}%` : "N/A"}
        tone={mom != null && mom >= 0 ? "up" : "down"}
      />
      <Kpi
        label="12M 누적"
        value={roll != null && Number.isFinite(roll) ? formatUsdBn(roll) : "N/A"}
      />
      <Kpi
        label="무역수지"
        value={bal != null ? formatUsdBn(bal) : "N/A"}
        sub={matchedImp ? `수입 ${formatUsdBn(matchedImp.valueUsd)}` : "수입 대기"}
        tone={bal != null && bal >= 0 ? "up" : "down"}
      />
      <Kpi
        label="KOSPI"
        value={k ? k.value.toFixed(0) : "N/A"}
        sub={k ? `${k.date.slice(0, 7)} 월말` : macro.data?.source}
      />
    </div>
  );
}

function clipRange<T extends { period?: string; date?: string }>(
  rows: T[],
  range: string,
): T[] {
  if (range === "MAX" || rows.length === 0) return rows;
  const years = range === "1Y" ? 1 : range === "3Y" ? 3 : range === "10Y" ? 10 : 5;
  const ym = kstYmd().slice(0, 7);
  const [yy, mm] = ym.split("-");
  const key = `${Number(yy) - years}-${mm}`;
  return rows.filter((r) => (r.period ?? r.date ?? "") >= key);
}

function addMonths(period: string | undefined, delta: number): string | undefined {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return undefined;
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y!, (m ?? 1) - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function numOrNull(v: number | null | undefined): number | null {
  return v != null && Number.isFinite(v) ? v : null;
}

function TotalPanel() {
  const lang = useExportDeskStore((s) => s.lang);
  const settings = useExportDeskStore((s) => s.settings);
  const demo = useExportDeskStore((s) => s.demoMode);
  const exports = useExportSeries("TOTAL");
  const macro = useExportMacro();
  // D9: hook hoisted out of JSX (was called behind `demo && …`).
  const allObservations = useAllObservations();
  const kospiMonth = useMemo(
    () =>
      resampleDailyToMonthEnd(
        (macro.data?.kospi ?? []).map((p) => ({ date: p.date, value: p.value })),
      ),
    [macro.data?.kospi],
  );

  const chart = useMemo(() => {
    const values = exports.map((e) => e.valueUsd);
    const wad = exports.map((e) =>
      calculateWorkingDayAdjusted(e.valueUsd, e.workingDays ?? 0) ?? NaN,
    );
    const roll = calculateRolling12MSum(values);
    const yoy = calculateYoYGrowth(values);
    const mom = calculateMomentum(values, 3);
    const level =
      settings.levelSeries === "raw"
        ? values
        : settings.levelSeries === "wad"
          ? wad
          : roll;
    const byP = new Map(kospiMonth.map((k) => [k.period, k.value]));
    const aligned = exports.map((e, i) => {
      const k = byP.get(e.period);
      return {
        period: e.period,
        exp: level[i]!,
        kospi: k ?? NaN,
        yoy: yoy[i]!,
        mom: mom[i]!,
      };
    });
    const clipped = clipRange(aligned, settings.range).filter(
      (r) => Number.isFinite(r.exp) || Number.isFinite(r.kospi),
    );
    const expIdx = normalizeToBase100(clipped.map((r) => r.exp));
    const kIdx = normalizeToBase100(clipped.map((r) => r.kospi));
    const kYoy = calculateYoYGrowth(clipped.map((r) => r.kospi), 12);
    const fxSeries = macro.data?.fx ?? [];
    const spot = macro.data?.spotUsdKrw ?? 0;
    return clipped.map((r, i) => {
      const fx = fxRateForPeriod(r.period, fxSeries, spot);
      return {
        ...r,
        exp: numOrNull(r.exp),
        kospi: numOrNull(r.kospi),
        yoy: numOrNull(r.yoy),
        mom: numOrNull(r.mom),
        expIdx: numOrNull(expIdx[i]),
        kIdx: numOrNull(kIdx[i]),
        kYoy: numOrNull(kYoy[i]),
        expKrw: numOrNull(fx != null ? convertUsdKrw(r.exp, fx) ?? NaN : NaN),
      };
    });
  }, [exports, kospiMonth, settings.levelSeries, settings.range, macro.data?.fx, macro.data?.spotUsdKrw]);

  const last = chart.filter((r) => r.exp != null).at(-1);
  const lastK = chart.filter((r) => r.kospi != null).at(-1);
  const totalSource =
    demo && !allObservations.some((o) => o.categoryId === "TOTAL" && o.sourceFile !== "DEMO") ? "DEMO" : last ? "FRED/OECD XTEXVA01KRM667S" : "대기";

  return (
    <section className="desk-card desk-card-navy p-4 space-y-4">
      <h2 className="text-lg font-semibold">{t("export.total.title", lang)}</h2>
      {settings.levelSeries === "raw" && (
        <p className="text-xs text-desk-copper">{t("export.seasonal", lang)}</p>
      )}
      <div className="grid gap-2 sm:grid-cols-4">
        <Kpi
          label="수출 (선택 시계열)"
          value={last?.exp != null ? formatUsdBn(last.exp) : "N/A"}
          sub={last?.period ?? "—"}
        />
        <Kpi
          label="YoY"
          value={last?.yoy != null ? `${last.yoy.toFixed(1)}%` : "N/A"}
        />
        <Kpi
          label="3M momentum"
          value={last?.mom != null ? `${last.mom.toFixed(1)}%` : "N/A"}
        />
        <Kpi
          label="KOSPI"
          value={lastK?.kospi != null ? lastK.kospi.toFixed(0) : "N/A"}
          sub={macro.data?.source ?? ""}
        />
      </div>
      {exports.length === 0 ? (
        <EmptyExport />
      ) : chart.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          시계열은 있으나 선택한 기간에 그릴 점이 없습니다. 기간을 MAX로 바꿔 보세요.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block size-2 rounded-full bg-desk-gold" /> 수출
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block size-2 rounded-full" style={{ background: "#3b82f6" }} /> KOSPI
            </span>
            <span>드래그로 이동 · 휠로 확대</span>
          </div>
          <ExportDualChart
            data={chart.map((r) => ({
              time: r.period,
              a:
                settings.chartMode === "absolute"
                  ? r.exp
                  : settings.chartMode === "growth"
                    ? r.yoy
                    : settings.chartMode === "krw"
                      ? r.expKrw
                      : r.expIdx,
              b:
                settings.chartMode === "krw"
                  ? null
                  : settings.chartMode === "growth"
                    ? r.kYoy
                    : settings.chartMode === "absolute"
                      ? r.kospi
                      : r.kIdx,
            }))}
            aName={
              settings.chartMode === "growth"
                ? "수출 YoY"
                : settings.chartMode === "krw"
                  ? "수출 KRW"
                  : settings.chartMode === "absolute"
                    ? "수출 USD"
                    : "수출=100"
            }
            bName={settings.chartMode === "growth" ? "KOSPI YoY" : settings.chartMode === "absolute" ? "KOSPI" : "KOSPI=100"}
            source={`수출 ${totalSource} · KOSPI ${macro.data?.source ?? "—"}`}
            asOf={macro.data?.fetchedAt ?? null}
            mode={settings.chartMode === "growth" ? "월간 · 전년 대비 %" : settings.chartMode === "absolute" ? "월간 · 수출 USD(좌) / KOSPI(우)" : settings.chartMode === "krw" ? "월간 · 원화 환산" : "월간 · 기준=100"}
          />
        </div>
      )}
      <Provenance
        source={totalSource}
        period={`${chart[0]?.period ?? "—"} ~ ${chart.at(-1)?.period ?? "—"}`}
        ingested={macro.data?.fetchedAt ?? "—"}
        taxonomy={getCore20().taxonomyVersion}
      />
      <LiveNewsStrip />
    </section>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "up" | "down";
}) {
  return (
    <div className="rounded-lg border border-border bg-card/60 px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "text-lg font-semibold tabular",
          tone === "up" && "text-price-up",
          tone === "down" && "text-price-down",
        )}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}

function formatUsdBn(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}bn`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}m`;
  return `$${v.toLocaleString("en-US")}`;
}

function LiveNewsStrip() {
  const live = useLiveTrade();
  const items = live.data?.news ?? [];
  if (!items.length) return null;
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold text-muted-foreground">수출 헤드라인 (원문 링크 · 수치는 차트에 넣지 않음)</div>
      <ul className="space-y-1">
        {items.slice(0, 6).map((n) => (
          <li key={n.url} className="text-xs leading-snug">
            <a href={n.url} target="_blank" rel="noreferrer" className="hover:underline">
              {n.title}
            </a>
            <span className="ml-2 text-muted-foreground">
              {n.source}
              {n.publishedAt ? ` · ${n.publishedAt.slice(0, 10)}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyExport() {
  const lang = useExportDeskStore((s) => s.lang);
  const live = useLiveTrade();
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
      <Info className="mx-auto mb-2 size-5" />
      {live.isLoading
        ? "공식 수출 시계열을 수집하고 있습니다."
        : live.isError
          ? "공식 소스 연결에 실패했습니다. 잠시 후 새로고침하거나 CSV를 가져오세요."
          : t("export.empty.exports", lang)}
    </div>
  );
}

function Core20Panel({ onOpen }: { onOpen: (cat: string) => void }) {
  const allItems = getCore20().items as { key: string; ko: string; en: string; subItems: string[]; addedIn2026Revision?: boolean }[];
  const [rev, setRev] = useState<"20" | "15">("20");
  const [focus, setFocus] = useState("semiconductors");
  const [picked, setPicked] = useState<string[]>(["semiconductors", "automobiles", "ships", "petroleum_products"]);
  const items = rev === "20" ? allItems : allItems.filter((it) => !it.addedIn2026Revision);
  const lang = useExportDeskStore((s) => s.lang);
  const all = useAllObservations();
  const exposures = useExportDeskStore((s) => s.exposures);
  const settings = useExportDeskStore((s) => s.settings);
  const live = useLiveTrade();
  const totals = all.filter((o) => o.categoryId === "TOTAL");
  const amountSeries = items
    .filter((it) => picked.includes(it.key))
    .map((it) => ({
      id: it.key,
      name: lang === "en" ? it.en : it.ko,
      points: all
        .filter((o) => o.categoryId === it.key && Number.isFinite(o.valueUsd) && o.valueUsd > 0)
        .sort((a, b) => a.period.localeCompare(b.period))
        .map((o) => ({ time: o.period, value: o.valueUsd / 1e9 })),
    }))
    .filter((s) => s.points.length >= 2);
  const focusId = amountSeries.some((s) => s.id === focus) ? focus : (amountSeries[0]?.id ?? focus);

  function togglePick(key: string) {
    setPicked((cur) => {
      if (cur.includes(key)) return cur.filter((k) => k !== key);
      if (cur.length >= 6) return cur;
      return [...cur, key];
    });
    setFocus(key);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-medium text-emerald-300">확정 · UN Comtrade HS</span>
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-200">MOTIE 속보 미연결</span>
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-200">관세청 API 키 없음</span>
          <span className="rounded border border-border px-1.5 py-0.5">MTI-2026 · 2026-06-01</span>
        </div>
        2026 MTI 개정으로 15대에서 20대로 늘었습니다. 구/신 토글은 품목 목록만 바꿉니다. 금액은 만들지 않습니다.
        표시 금액은 HS 근사이며 MOTIE MTI 잠정치가 아닙니다. HS 85를 반도체로 대체하지 않습니다. 매핑이 없거나 관측이 없으면 N/A.
        부분 품목 합을 총수출 100%로 늘려 맞추지 않습니다.
      </div>
      <div className="flex flex-wrap gap-1">
        <button type="button" className={cn("h-8 rounded-md px-2 text-xs", rev === "20" ? "bg-desk-gold/20 text-desk-gold" : "bg-muted text-muted-foreground")} onClick={() => setRev("20")}>
          신 20대
        </button>
        <button type="button" className={cn("h-8 rounded-md px-2 text-xs", rev === "15" ? "bg-desk-gold/20 text-desk-gold" : "bg-muted text-muted-foreground")} onClick={() => setRev("15")}>
          구 15대
        </button>
        <span className="self-center text-[11px] text-muted-foreground">
          표시 {items.length} · Comtrade {live.data?.comtradeLatestPeriod ?? "N/A"} · 캐시 {live.data?.comtradeMonthsCached ?? 0}개월
        </span>
      </div>
      {amountSeries.length > 0 ? (
        <ExportAmountChart series={amountSeries} focusId={focusId} source="UN Comtrade preview HS" asOf={live.data?.source.fetchedAt ?? null} />
      ) : (
        <div className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          {live.isLoading ? "HS 품목 시계열 수집 중" : "선택한 품목에 그릴 Comtrade 관측이 없습니다. 금액을 채우지 않습니다."}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        최대 6개 오버레이. 카드를 누르면 산업 × 주가 비교로 이동합니다. 고저 마커는 포커스 품목(마지막에 고른 항목)에만 그립니다.
      </p>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => {
        const series = all
          .filter((o) => o.categoryId === it.key)
          .sort((a, b) => a.period.localeCompare(b.period));
        const last = series.at(-1);
        const prev = series.find((s) => s.period === addMonths(last?.period, -12));
        const yoy =
          last && prev && prev.valueUsd ? ((last.valueUsd / prev.valueUsd - 1) * 100).toFixed(1) : "N/A";
        const total = last ? totals.find((t) => t.period === last.period) : undefined;
        const share = last && total && total.valueUsd > 0 ? (last.valueUsd / total.valueUsd) * 100 : null;
        const mapped = exposures.filter((e) => e.exportCategoryId === it.key && e.active !== false);
        const verified = mapped.filter((e) => e.mappingConfidence >= settings.minConfidence);
        const proxy = proxyForKey(it.key);
        const on = picked.includes(it.key);
        return (
          <div key={it.key} className={cn("desk-card desk-card-teal p-3 text-left", on && "ring-1 ring-desk-gold/50")}>
            <button type="button" onClick={() => onOpen(it.key)} className="w-full text-left">
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-semibold">{lang === "en" ? it.en : it.ko}</div>
              {it.addedIn2026Revision && <span className="text-[10px] text-desk-gold">2026 신설</span>}
            </div>
            <div className="mt-1 text-lg tabular font-semibold">
              {last ? formatUsdBn(last.valueUsd) : proxy ? "N/A" : "HS 없음"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              YoY {yoy}
              {share != null ? ` · FRED 총수출 대비 ${share.toFixed(1)}% (정의 상이)` : " · 비중 N/A"}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              <Badge variant="outline" className="text-[10px]">
                {proxy ? "확정 HS" : "HS 없음"}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {proxy ? proxy.label : "N/A"}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                매핑 {verified.length}/{mapped.length}
              </Badge>
            </div>
            {it.subItems.length > 0 && (
              <div className="mt-2 text-[11px] text-muted-foreground">{it.subItems.join(" · ")}</div>
            )}
            </button>
            <button
              type="button"
              className="mt-2 text-[11px] text-desk-gold hover:underline"
              onClick={() => togglePick(it.key)}
            >
              {on ? "오버레이에서 빼기" : picked.length >= 6 ? "오버레이 6개 가득 참" : "오버레이에 넣기"}
            </button>
          </div>
        );
      })}
    </div>
    </div>
  );
}

function AllIndustriesPanel({ onOpen }: { onOpen: (cat: string) => void }) {
  const observations = useAllObservations();
  const [q, setQ] = useState("");
  const [onlyMapped, setOnlyMapped] = useState(false);
  const exposures = useExportDeskStore((s) => s.exposures);
  const core = getCore20().items as { key: string; ko: string }[];
  const cats = useMemo(() => {
    const map = new Map<string, { id: string; name: string; value: number; period: string }>();
    for (const it of core) {
      map.set(it.key, { id: it.key, name: it.ko, value: 0, period: "" });
    }
    for (const o of observations) {
      const prev = map.get(o.categoryId);
      if (!prev || o.period >= prev.period) {
        map.set(o.categoryId, {
          id: o.categoryId,
          name: o.categoryName ?? o.categoryId,
          value: o.valueUsd,
          period: o.period,
        });
      }
    }
    let rows = [...map.values()].filter((r) => r.value > 0 || core.some((c) => c.key === r.id));
    if (q.trim()) {
      const n = q.trim().toLowerCase();
      rows = rows.filter((r) => r.id.toLowerCase().includes(n) || r.name.toLowerCase().includes(n));
    }
    if (onlyMapped) {
      const ids = new Set(exposures.filter((e) => e.active !== false).map((e) => e.exportCategoryId));
      rows = rows.filter((r) => ids.has(r.id));
    }
    return rows.sort((a, b) => b.value - a.value);
  }, [observations, q, onlyMapped, exposures, core]);

  const barRows = cats.filter((c) => c.id.startsWith("hs2:") && c.value > 0).slice(0, 15);
  const bar = barRows.map((c) => ({ name: c.name.replace(/ \(HS.*$/, ""), value: c.value / 1e9, id: c.id }));
  const barAsOf = barRows.reduce((m, c) => (c.period > m ? c.period : m), ""); // ked-allow-string-date-sort: single-format time series
  const barSources = [...new Set(observations.filter((o) => barRows.some((c) => c.id === o.categoryId)).map((o) => o.sourceFile))].slice(0, 2).join(", ");

  return (
    <section className="desk-card p-4">
      <div className="mb-3 flex flex-wrap gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="품목명 · 코드" className="max-w-xs" />
        <label className="inline-flex items-center gap-1.5 text-xs">
          <Switch checked={onlyMapped} onCheckedChange={setOnlyMapped} />
          Top-100 매칭 있는 산업만
        </label>
      </div>
      {bar.length > 0 && (
        <div className="mb-4">
          <ChartFrame
            title="수출 상위 품목 (HS 2단위, 품목별 최신월)"
            unit="USD bn"
            source={barSources || "수출 관측값"}
            asOf={barAsOf || null}
            ariaLabel={`수출 상위 ${bar.length}개 품목 막대 차트: ${bar.slice(0, 5).map((b) => `${b.name} ${b.value.toFixed(1)}bn`).join(", ")}`}
            pngName={chartExportName("KR", "EXPORT", "top-hs2", "png", Date.now())}
            csv={() => ({
              text: ["id,name,period,value_usd_bn", ...barRows.map((c) => `${c.id},"${c.name.replace(/"/g, "'")}",${c.period},${(c.value / 1e9).toFixed(3)}`)].join("\n"),
              filename: chartExportName("KR", "EXPORT", "top-hs2", "csv", Date.now()),
            })}
            testId="export-top-bar"
          >
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bar} layout="vertical" margin={{ left: 80 }} accessibilityLayer>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" tick={{ fontSize: 10 }} unit="bn" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={76} />
                  <Tooltip formatter={(v: number) => `$${Number(v).toFixed(1)}bn`} />
                  <Bar dataKey="value" fill="#d4a017" name="수출 $bn" onClick={(d) => onOpen(String((d as { id?: string }).id))} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartFrame>
        </div>
      )}
      <div className="overflow-auto max-h-[520px] scroll-thin">
        <table className="desk-table w-full">
          <thead>
            <tr>
              <th>산업</th>
              <th>코드</th>
              <th className="text-right">최신 수출</th>
              <th>티어</th>
            </tr>
          </thead>
          <tbody>
            {cats.map((c) => (
              <tr
                key={c.id}
                className="cursor-pointer hover:bg-muted/30"
                onClick={() => onOpen(c.id)}
              >
                <td>{c.name}</td>
                <td className="tabular text-xs">{c.id}</td>
                <td className="text-right tabular">{c.value ? formatUsdBn(c.value) : "N/A"}</td>
                <td>
                  <Badge variant="outline" className="text-[10px]">
                    {core.some((x) => x.key === c.id) ? "T1" : "T3"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function IndustryPanel({
  cat,
  onCat,
}: {
  cat: string;
  onCat: (c: string) => void;
}) {
  const lang = useExportDeskStore((s) => s.lang);
  const items = getCore20().items as { key: string; ko: string }[];
  const observations = useAllObservations();
  const extraCats = [...new Set(observations.map((o) => o.categoryId))].filter(
    (id) => id !== "TOTAL" && !items.some((it) => it.key === id),
  );
  const settings = useExportDeskStore((s) => s.settings);
  const exposures = useExportDeskStore((s) => s.exposures);
  const caps = useKospiCapQuotes();
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showNames, setShowNames] = useState(true);
  const asOf = kstYmd();

  const universe = useMemo(() => {
    const rows: RankableSecurity[] = (caps.data?.quotes ?? [])
      .filter((q) => q.market === "KOSPI" && q.marketCap > 0)
      .map((q) => ({
        ticker: q.ticker,
        name: q.name,
        marketCap: q.marketCap,
        date: asOf,
        isPreferred: q.isPreferred,
      }));
    return rankKospiByMarketCap(rows, { n: settings.universeN, date: asOf });
  }, [caps.data, asOf, settings.universeN]);

  const tickers = new Set(universe.map((u) => u.ticker));
  const matched = resolveCompanySectorExposure(exposures, {
    categoryId: cat,
    asOf,
    top100Tickers: tickers,
    minWeight: verifiedOnly ? settings.minWeight : 0.05,
    minConfidence: verifiedOnly ? settings.minConfidence : 0,
    primaryOnly: settings.primaryOnly,
  });
  const chartNames = matched.slice(0, 8);
  const px = useIndustryMonthlyPrices(chartNames.map((m) => m.ticker));
  const exports = useExportSeries(cat);
  const quotes = new Map((caps.data?.quotes ?? []).map((q) => [q.ticker, q]));

  const overlay = useMemo(() => {
    const values = exports.map((e) => e.valueUsd);
    const roll = calculateRolling12MSum(values);
    const yoy = calculateYoYGrowth(values);
    const byPeriod = new Map<string, Record<string, number>>();
    for (const e of exports) {
      byPeriod.set(e.period, { exp: e.valueUsd });
    }
    for (const m of chartNames) {
      const s = px.data?.series[m.ticker] ?? [];
      for (const p of s) {
        const period = p.date.slice(0, 7);
        const row = byPeriod.get(period) ?? {};
        row[m.ticker] = p.value;
        byPeriod.set(period, row);
      }
    }
    const periods = [...byPeriod.keys()].sort();
    const expSeries = periods.map((_, i) => {
      const match = exports.findIndex((e) => e.period === periods[i]);
      return match >= 0 ? roll[match]! : NaN;
    });
    const expIdx = normalizeToBase100(expSeries);
    const weightSum = chartNames.reduce((s, m) => s + m.exposureWeight, 0) || 1;
    const composite = periods.map((p) => {
      let acc = 0;
      let w = 0;
      for (const m of chartNames) {
        const v = byPeriod.get(p)?.[m.ticker];
        if (v != null && Number.isFinite(v)) {
          acc += v * m.exposureWeight;
          w += m.exposureWeight;
        }
      }
      return w > 0 ? acc / w : NaN;
    });
    const compIdx = normalizeToBase100(composite);
    const nameIdx: Record<string, number[]> = {};
    for (const m of chartNames) {
      nameIdx[m.ticker] = normalizeToBase100(
        periods.map((p) => byPeriod.get(p)?.[m.ticker] ?? NaN),
      );
    }
    return periods.map((period, i) => {
      const rec: Record<string, string | number | null> = {
        period,
        expIdx: numOrNull(expIdx[i]),
        compIdx: numOrNull(compIdx[i]),
        yoy: (() => {
          const j = exports.findIndex((e) => e.period === period);
          return j >= 0 ? numOrNull(yoy[j]) : null;
        })(),
      };
      for (const m of chartNames) rec[m.ticker] = numOrNull(nameIdx[m.ticker]?.[i]);
      return rec;
    });
  }, [exports, px.data, chartNames]);

  const clipped = useMemo(
    () => clipRange(overlay, settings.range),
    [overlay, settings.range],
  );
  const yoyByPeriod = new Map<string, number>();
  {
    const y = calculateYoYGrowth(exports.map((x) => x.valueUsd));
    exports.forEach((e, i) => {
      const v = y[i];
      if (v != null && Number.isFinite(v)) yoyByPeriod.set(e.period, v);
    });
  }
  const yoyCByPeriod = new Map<string, number>();
  {
    const y = calculateYoYGrowth(
      overlay.map((r) => (typeof r.compIdx === "number" ? r.compIdx : NaN)),
    );
    overlay.forEach((r, i) => {
      const v = y[i];
      if (v != null && Number.isFinite(v)) yoyCByPeriod.set(String(r.period), v);
    });
  }
  const yoyE = clipped.map((r) => yoyByPeriod.get(String(r.period)) ?? NaN);
  const yoyC = clipped.map((r) => yoyCByPeriod.get(String(r.period)) ?? NaN);
  const inf = pearsonWithInference(yoyE, yoyC, { transform: "yoy" });
  const catLabel =
    items.find((i) => i.key === cat)?.ko ??
    (cat.startsWith("hs2:") ? hsName(cat.slice(4)) : cat);
  const PALETTE = ["#60a5fa", "#34d399", "#f472b6", "#a78bfa", "#fbbf24", "#22d3ee", "#fb7185", "#c084fc"];

  return (
    <section className="desk-card desk-card-indigo p-4 space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <select
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          value={cat}
          onChange={(e) => onCat(e.target.value)}
        >
          {items.map((it) => (
            <option key={it.key} value={it.key}>
              {it.ko}
            </option>
          ))}
          {extraCats
            .sort()
            .map((id) => (
              <option key={id} value={id}>
                {id.startsWith("hs2:") ? hsName(id.slice(4)) : id}
              </option>
            ))}
        </select>
        <label className="inline-flex items-center gap-1.5 text-xs">
          <Switch
            checked={settings.primaryOnly}
            onCheckedChange={(v) => useExportDeskStore.getState().patchSettings({ primaryOnly: v })}
          />
          주력 노출만
        </label>
        <label className="inline-flex items-center gap-1.5 text-xs">
          <Switch checked={verifiedOnly} onCheckedChange={setVerifiedOnly} />
          검증된 매핑만
        </label>
        <label className="inline-flex items-center gap-1.5 text-xs">
          <Switch checked={showNames} onCheckedChange={setShowNames} />
          개별 종목선
        </label>
        <span className="text-[11px] text-muted-foreground">
          Top {settings.universeN} · 매칭 {matched.length}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        <strong>{catLabel}</strong> 수출(12M 누적, 지수=100)과 시총 Top {settings.universeN} 중
        해당 산업 노출 기업의 주가. 관세 통계는 제품이지 기업이 아닙니다 — 분석용 노출 맵이며
        세관 귀속이 아닙니다. 시총 순위: {caps.data?.source ?? "N/A"} (당일, 과거 소급 아님).
      </p>
      {exports.length === 0 ? (
        <EmptyExport />
      ) : (
        <ExportDualChart
          data={clipped.map((r) => ({
            time: String(r.period),
            a: typeof r.expIdx === "number" ? r.expIdx : null,
            b: typeof r.compIdx === "number" ? r.compIdx : null,
          }))}
          aName={`${catLabel} 수출`}
          bName="노출가중 주가"
        />
      )}
      <div className="grid gap-2 sm:grid-cols-3">
        <Kpi
          label="수출-주가 YoY 상관"
          value={inf.insufficient ? t("export.insufficient", lang) : inf.r == null ? "N/A" : inf.r.toFixed(3)}
          sub={inf.insufficient ? `N=${inf.n}` : `N=${inf.n} HAC`}
        />
        <Kpi label="매칭 기업" value={String(matched.length)} sub={`차트 ${chartNames.length}개`} />
        <Kpi
          label="유니버스"
          value={`${universe.length}`}
          sub={caps.data?.source ?? "N/A"}
        />
      </div>
      {matched.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm">
          {t("export.empty.sector", lang)}
        </div>
      ) : (
        <table className="desk-table w-full">
          <thead>
            <tr>
              <th>종목</th>
              <th>역할</th>
              <th className="text-right">노출</th>
              <th className="text-right">시총순위</th>
              <th className="text-right">등락</th>
              <th>검증</th>
            </tr>
          </thead>
          <tbody>
            {matched.map((m) => {
              const q = quotes.get(m.ticker);
              const rank = universe.find((u) => u.ticker === m.ticker)?.rank;
              return (
                <tr key={m.ticker}>
                  <td>
                    <Link to="/stock/$ticker" params={{ ticker: m.ticker }} className="hover:underline">
                      {m.companyName}
                    </Link>
                    <div className="text-[10px] tabular text-muted-foreground">{m.ticker}</div>
                  </td>
                  <td className="text-xs">{m.valueChainRole}</td>
                  <td className="text-right tabular">{(m.exposureWeight * 100).toFixed(0)}%</td>
                  <td className="text-right tabular">{rank ?? "N/A"}</td>
                  <td
                    className={cn(
                      "text-right tabular",
                      (q?.changePct ?? 0) >= 0 ? "text-price-up" : "text-price-down",
                    )}
                  >
                    {q ? `${q.changePct.toFixed(2)}%` : "N/A"}
                  </td>
                  <td>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        m.verificationStatus === "UNVERIFIED_SEED" && "text-desk-copper",
                      )}
                    >
                      {m.verificationStatus === "UNVERIFIED_SEED" ? "미검증" : m.verificationStatus}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <Provenance
        source={`${caps.data?.source ?? "N/A"} · ${px.data?.source ?? "월봉 대기"}`}
        period={`${clipped[0]?.period ?? "—"} ~ ${clipped.at(-1)?.period ?? "—"}`}
        ingested={px.data?.fetchedAt ?? caps.data?.fetchedAt ?? "—"}
        taxonomy={getCore20().taxonomyVersion}
      />
    </section>
  );
}

function CorrPanel() {
  const lang = useExportDeskStore((s) => s.lang);
  const settings = useExportDeskStore((s) => s.settings);
  const exports = useExportSeries("TOTAL");
  const macro = useExportMacro();
  const kospi = useMemo(
    () =>
      resampleDailyToMonthEnd(
        (macro.data?.kospi ?? []).map((p) => ({ date: p.date, value: p.value })),
      ),
    [macro.data?.kospi],
  );
  const fx = useMemo(
    () =>
      resampleDailyToMonthEnd(
        (macro.data?.fx ?? []).map((p) => ({ date: p.date, value: p.value })),
      ),
    [macro.data?.fx],
  );

  const pack = useMemo(() => {
    const byK = new Map(kospi.map((k) => [k.period, k.value]));
    const byF = new Map(fx.map((k) => [k.period, k.value]));
    const aligned = exports.map((e) => ({
      period: e.period,
      exp: e.valueUsd,
      kospi: byK.get(e.period) ?? NaN,
      fx: byF.get(e.period) ?? NaN,
    }));
    const yoyE = calculateYoYGrowth(aligned.map((r) => r.exp));
    const yoyK = calculateYoYGrowth(aligned.map((r) => r.kospi));
    const yoyF = calculateYoYGrowth(aligned.map((r) => r.fx));
    const withYoy = aligned.map((r, i) => ({
      period: r.period,
      yoyE: yoyE[i]!,
      yoyK: yoyK[i]!,
      yoyF: yoyF[i]!,
    }));
    const windowed = clipRange(withYoy, settings.range);
    const e = windowed.map((r) => r.yoyE);
    const k = windowed.map((r) => r.yoyK);
    const f = windowed.map((r) => r.yoyF);
    const inf = pearsonWithInference(e, k, { transform: "yoy" });
    const raw = calculatePearson(e, k);
    const partial = calculatePartialCorrelation(e, k, f);
    const xcorr = calculateCrossCorrelation(e, k, 6);
    return { inf, raw, partial, xcorr, n: e.filter(Number.isFinite).length };
  }, [exports, kospi, fx, settings.range]);

  return (
    <section className="desk-card p-4 space-y-3">
      <h2 className="text-lg font-semibold">{t("export.corr.title", lang)}</h2>
      <p className="text-xs text-muted-foreground">
        RELEASE_TIME 정렬 권고. 점수는 예측이 아니라 사후 기술 통계입니다. 매수/매도 의견이 아닙니다.
      </p>
      {pack.inf.insufficient ? (
        <div className="rounded-md border px-3 py-6 text-center text-sm">
          {t("export.insufficient", lang)} (N={pack.inf.n})
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          <Kpi label="Pearson YoY (HAC)" value={pack.inf.r == null ? "N/A" : pack.inf.r.toFixed(3)} sub={`N=${pack.inf.n} SE=${pack.inf.se?.toFixed(3) ?? "N/A"}`} />
          <Kpi label="USD/KRW 통제 편상관" value={pack.partial == null ? "N/A" : pack.partial.toFixed(3)} />
          <Kpi
            label="최강 시차"
            value={
              pack.xcorr.filter((x) => x.corr != null).sort((a, b) => Math.abs(b.corr!) - Math.abs(a.corr!))[0]
                ? `lag ${pack.xcorr.filter((x) => x.corr != null).sort((a, b) => Math.abs(b.corr!) - Math.abs(a.corr!))[0]!.lag}`
                : "N/A"
            }
          />
        </div>
      )}
    </section>
  );
}

function RegionPanel() {
  const live = useLiveTrade();
  const dest = live.data?.destinations;
  const levels = regionalCap.levels as { id: string; ko: string; available?: boolean; reason?: string; note?: string }[];
  return (
    <section className="desk-card p-4 space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Globe2 className="size-4" /> 수출 목적지 · 지역
      </h2>
      <p className="text-xs text-muted-foreground">
        국가별은 UN Comtrade 총수출(HS TOTAL) 상대국입니다. 시도/시군구는 공식 미제공 시 숫자를 만들지 않습니다.
      </p>
      {dest?.rows.length ? (
        <table className="desk-table w-full">
          <thead>
            <tr>
              <th>상대국</th>
              <th className="text-right">수출</th>
              <th className="text-right">비중</th>
            </tr>
          </thead>
          <tbody>
            {dest.rows.map((r) => (
              <tr key={r.partnerCode}>
                <td>{r.name}</td>
                <td className="text-right tabular">{formatUsdBn(r.valueUsd)}</td>
                <td className="text-right tabular">{(r.share * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="text-sm text-muted-foreground">
          {live.isLoading ? "상대국 집계 수집 중" : "상대국 스냅샷이 아직 없습니다. 화면을 한 번 더 열면 캐시가 쌓입니다."}
        </div>
      )}
      <Provenance
        source={dest?.source ?? "N/A"}
        period={dest?.period ?? "—"}
        ingested={live.data?.source.fetchedAt ?? "—"}
        taxonomy="HS TOTAL"
      />
      <ul className="space-y-2">
        {levels.map((lv) => (
          <li key={lv.id} className="rounded-md border border-border px-3 py-2 text-sm">
            <div className="font-medium">{lv.ko}</div>
            {lv.available === false ? (
              <div className="text-xs text-desk-copper">{lv.reason ?? "제공되지 않음"}</div>
            ) : (
              <div className="text-xs text-muted-foreground">{lv.note ?? "가져오기 후 표시"}</div>
            )}
          </li>
        ))}
      </ul>
      <SigunguGuard />
    </section>
  );
}

function SigunguGuard() {
  const [geo, setGeo] = useState("SIDO");
  const [cls, setCls] = useState("HS");
  const cap = resolveRegionalCapability(geo, cls, regionalCap);
  const forbidden = !cap.available;
  const reason = cap.reason;
  return (
    <div className="rounded-md bg-muted/40 p-3 text-sm">
      <div className="flex gap-2 mb-2">
        <select value={geo} onChange={(e) => setGeo(e.target.value)} className="h-8 rounded border bg-background px-2">
          <option>NATIONAL</option>
          <option>SIDO</option>
          <option>SIGUNGU</option>
        </select>
        <select value={cls} onChange={(e) => setCls(e.target.value)} className="h-8 rounded border bg-background px-2">
          <option>HS</option>
          <option>MTI</option>
          <option>HSK10</option>
        </select>
      </div>
      {forbidden ? (
        <div className="text-desk-copper text-xs">
          {reason ?? "공식 시계열이 없습니다. 숫자를 합성하지 않습니다."}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">선택한 큐브는 가져오기 후에만 값이 있습니다.</div>
      )}
    </div>
  );
}

function QaPanel() {
  const observations = useAllObservations();
  const demo = useExportDeskStore((s) => s.demoMode);
  const logs = useExportDeskStore((s) => s.logs);
  const live = useLiveTrade();
  const totals = observations.filter((o) => o.categoryId === "TOTAL");
  const parts = observations.filter((o) => o.categoryId.startsWith("hs2:"));
  const lastP = [...new Set(parts.map((p) => p.period))].sort().at(-1);
  const official = totals.find((t) => t.period === lastP)?.valueUsd;
  const recon =
    lastP && official != null
      ? validateTradeTotals(
          parts.filter((p) => p.period === lastP).map((p) => p.valueUsd),
          official,
        )
      : null;
  return (
    <section className="desk-card p-4 space-y-3">
      <h2 className="text-lg font-semibold">데이터 품질 / 출처</h2>
      <ul className="text-xs space-y-1 text-muted-foreground">
        <li>· 총수출·총수입: FRED/OECD 월간 (XTEXVA01KRM667S, XTIMVA01KRM667S). 통관 속보가 아닙니다.</li>
        <li>· 품목: UN Comtrade HS 공개 프리뷰. MTI 코드가 아니며 HS 85를 반도체로 쓰지 않습니다.</li>
        <li>· 산업부 월간 수출입 동향(잠정)과 관세청 data.go.kr API는 서비스 키가 없어 미연결입니다. 없는 금액은 N/A입니다.</li>
        <li>· 2026-06-01 MTI 개정: 15대→20대. 구 15대 토글은 2026년 신설 5개 품목을 목록에서만 뺍니다.</li>
        {(live.data?.notes ?? []).map((n) => (
          <li key={n}>· {n}</li>
        ))}
        <li>
          · 총수출 관측 {totals.length}개월 · HS2 품목월 {parts.length}행 · Comtrade 캐시{" "}
          {live.data?.comtradeMonthsCached ?? 0}개월
        </li>
      </ul>
      <SourceHealth />
      <div className="text-sm">
        HS2 합 vs FRED 총수출 {recon ? (recon.pass ? "PASS" : "WARN") : "N/A"}
        {recon && ` · gap ${recon.gapPct.toFixed(2)}%`}
        <span className="block text-[11px] text-muted-foreground">
          정의가 다르면 갭이 정상입니다 (HS vs OECD 총수출).
        </span>
      </div>
      <label className="inline-flex items-center gap-1.5 text-xs">
        <Switch checked={demo} onCheckedChange={(v) => useExportDeskStore.getState().setDemoMode(v)} />
        DEMO MODE (합성 숫자 — 기본 꺼짐)
      </label>
      <div className="text-xs text-muted-foreground">로그 {logs.length}건</div>
      <ul className="text-xs space-y-1 max-h-48 overflow-auto">
        {logs.map((l) => (
          <li key={l.id}>
            {l.importedAt.slice(0, 19)} · {l.importer} · {l.filename} · {l.rowCount}행
          </li>
        ))}
      </ul>
    </section>
  );
}

function SourceHealth() {
  const keys = useExportDeskStore((s) => s.sourceKeys);
  const setKey = useExportDeskStore((s) => s.setSourceKey);
  return (
    <div className="overflow-auto">
      <table className="desk-table w-full text-xs">
        <thead>
          <tr>
            <th>소스</th>
            <th>운영</th>
            <th>상태</th>
            <th>키</th>
          </tr>
        </thead>
        <tbody>
          {DATA_SOURCES.map((s) => (
            <tr key={s.id}>
              <td>
                <a href={s.portal} target="_blank" rel="noreferrer" className="hover:underline">
                  {s.displayName}
                </a>
              </td>
              <td>{s.operator}</td>
              <td>{s.status}</td>
              <td>
                {s.authMode === "NONE" ? (
                  "—"
                ) : (
                  <Input
                    type="password"
                    className="h-7 text-xs"
                    value={keys[s.id] ?? ""}
                    placeholder="serviceKey (로컬만)"
                    onChange={(e) => setKey(s.id, e.target.value)}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-muted-foreground">
        미검증 엔드포인트는 Settings에서 연결 테스트 전까지 live로 표시하지 않습니다.
      </p>
    </div>
  );
}

function AdminPanel() {
  const exposures = useExportDeskStore((s) => s.exposures);
  const upsert = useExportDeskStore((s) => s.upsertExposure);
  const remove = useExportDeskStore((s) => s.removeExposure);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    ticker: "",
    companyName: "",
    exportCategoryId: "semiconductors",
    exposureWeight: "0.6",
    mappingConfidence: "0.8",
  });

  function save() {
    const row: CompanyExportExposure = {
      ticker: normalizeKrTicker(form.ticker),
      companyName: form.companyName || form.ticker,
      exportCategoryId: form.exportCategoryId,
      exportCategoryName: form.exportCategoryId,
      valueChainRole: "DEVICE_MAKER",
      exposureWeight: Number(form.exposureWeight),
      mappingConfidence: Number(form.mappingConfidence),
      mappingType: "PRIMARY",
      verificationStatus: "VERIFIED_MANUAL",
      evidenceSummary: "Manual desk edit",
      evidenceSource: [],
      effectiveFrom: kstYmd(),
      lastReviewedAt: kstYmd(),
      active: true,
    };
    const r = upsert(row);
    setErr(r.ok ? null : r.error ?? "저장 실패");
  }

  return (
    <section className="desk-card p-4 space-y-3">
      <h2 className="text-lg font-semibold">매핑 관리</h2>
      <div className="grid gap-2 sm:grid-cols-5">
        <Input placeholder="코드" value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} />
        <Input placeholder="이름" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
        <Input
          placeholder="산업 key"
          value={form.exportCategoryId}
          onChange={(e) => setForm({ ...form, exportCategoryId: e.target.value })}
        />
        <Input
          placeholder="가중"
          value={form.exposureWeight}
          onChange={(e) => setForm({ ...form, exposureWeight: e.target.value })}
        />
        <Button type="button" onClick={save}>
          저장 (수동검증)
        </Button>
      </div>
      {err && <div className="text-sm text-price-down">{err}</div>}
      <div className="overflow-auto max-h-[420px]">
        <table className="desk-table w-full text-xs">
          <thead>
            <tr>
              <th>종목</th>
              <th>산업</th>
              <th>가중</th>
              <th>신뢰</th>
              <th>상태</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {exposures.map((e) => (
              <tr key={`${e.ticker}-${e.exportCategoryId}`} className={e.active === false ? "opacity-50" : ""}>
                <td>
                  {e.companyName} <span className="tabular">{e.ticker}</span>
                </td>
                <td>{e.exportCategoryId}</td>
                <td className="tabular">{e.exposureWeight}</td>
                <td className="tabular">{e.mappingConfidence}</td>
                <td>
                  {e.verificationStatus}
                  {e.verificationStatus === "UNVERIFIED_SEED" && (
                    <Badge className="ml-1 chip-copper border-0 text-[9px]">미검증</Badge>
                  )}
                </td>
                <td>
                  <button type="button" className="text-desk-rose" onClick={() => remove(e.ticker, e.exportCategoryId)}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ImportPanel() {
  const upsert = useExportDeskStore((s) => s.upsertObservations);
  const dump = useExportDeskStore((s) => s.exportStoreJson);
  const load = useExportDeskStore((s) => s.importStoreJson);
  const reset = useExportDeskStore((s) => s.resetStore);
  const [msg, setMsg] = useState<string | null>(null);
  const [importer, setImporter] = useState<ImporterId>("MTI_MONTHLY_EXPORT");

  async function onFile(f: File) {
    const text = await f.text();
    const res = importTradeCsv(text, f.name, importer);
    if (!res.ok) {
      setMsg(res.issues.map((i) => `${i.row}: ${i.message}`).join(" · "));
      return;
    }
    upsert(res.rows, {
      id: `${Date.now()}`,
      filename: f.name,
      importer,
      rowCount: res.rows.length,
      importedAt: res.importedAt,
      ok: true,
    });
    setMsg(`${res.rows.length}행 반영. 경고 ${res.issues.length}`);
  }

  return (
    <section className="desk-card p-4 space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <FileUp className="size-4" /> 데이터 가져오기 (Track F)
      </h2>
      <p className="text-xs text-muted-foreground">
        KITA/관세청/KRX에서 받은 CSV. 헤더는 한글·영문 모두 인식합니다. 단위:
        천달러·백만불·억달러.
      </p>
      <div className="flex flex-wrap gap-2">
        <select
          value={importer}
          onChange={(e) => setImporter(e.target.value as ImporterId)}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option>MTI_MONTHLY_EXPORT</option>
          <option>HS_MONTHLY_EXPORT</option>
          <option>REGIONAL_EXPORT</option>
          <option>KOSPI_INDEX_DAILY</option>
          <option>FX_USDKRW_DAILY</option>
        </select>
        <Input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
      </div>
      {msg && (
        <div className="text-sm flex items-start gap-1">
          <AlertTriangle className="size-4 mt-0.5" /> {msg}
        </div>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const blob = new Blob([dump()], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "export-desk-store.json";
            a.click();
          }}
        >
          Export Store
        </Button>
        <Button type="button" variant="outline" onClick={() => reset()}>
          Reset
        </Button>
        <Input
          type="file"
          accept="application/json"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const r = load(await f.text());
            setMsg(r.ok ? "스토어 복원" : r.error ?? "실패");
          }}
        />
      </div>
    </section>
  );
}
