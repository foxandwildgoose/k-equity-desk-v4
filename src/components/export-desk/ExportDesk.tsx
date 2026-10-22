import { useMemo, useState } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DATA_SOURCES } from "@/data/export-desk/dataSources.config";
import regionalCap from "@/data/export-desk/regionalCapability.config.json";
import { t } from "@/lib/export-desk/i18n";
import { completeMonthlyObservations } from "@/lib/export-desk/observation-integrity";
import { assertNoSyntheticLeak, getCore20, useExportDeskStore } from "@/lib/export-desk/store";
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
import { observedCapRanking } from "@/lib/export-desk/cap-ranking";
import { useMarketClock } from "@/lib/use-market-clock";
import { formatMarketAsOf } from "@/lib/market-presentation";
import {
  resolveCompanySectorExposure,
  isEvidenceBackedExposure,
  validateTradeTotals,
  type CompanyExportExposure,
} from "@/lib/export-desk/exposure";
import { resolveRegionalCapability } from "@/lib/export-desk/taxonomy";
import { importIndexCsv, importTradeCsv, type ImporterId } from "@/lib/export-desk/parse-import";
import {
  useExportMacro as useServerExportMacro,
  useIndustryMonthlyPrices,
  useKospiCapQuotes,
} from "@/lib/export-desk/use-macro";
import {
  useLiveTrade,
  useTradeCategory,
  useTradeCategoryCatalog,
  useMotieRelease,
  useTradeNews,
} from "@/lib/export-desk/use-live";
import type { CategoryCatalog, CategoryCatalogItem } from "@/lib/export-desk/category-catalog";
import type { MotieSnapshot } from "@/server/export-motie";
import { ExportAmountChart, ExportDualChart } from "@/components/export-desk/ExportDualChart";
import { ChartFrame } from "@/components/charts/core/ChartFrame";
import { chartExportName } from "@/lib/charts/tools";
import { aggregateProxy, CORE20_HS_PROXY, hsName, proxyForKey } from "@/lib/export-desk/hs-map";
import type { TradeObservation } from "@/lib/export-desk/parse-import";
import { cn } from "@/lib/utils";
import { kstYmd } from "@/lib/format";
import { normalizeKrTicker } from "@/lib/infer-sector";
import type { ExportProviderStatus } from "@/lib/export-desk/provider-status";
import { AlertTriangle, FileUp, Globe2, Info, RefreshCw, Ship } from "lucide-react";

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
    <div className="mt-2 flex min-w-0 max-w-full flex-wrap gap-1.5 break-words text-[10px] text-muted-foreground">
      <Badge
        variant="outline"
        className="min-w-0 max-w-full whitespace-normal break-words text-[10px]"
      >
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
  const settings = useExportDeskStore((s) => s.settings);
  const patch = useExportDeskStore((s) => s.patchSettings);
  const [tab, setTab] = useState<string>("total");
  const [selectedCat, setSelectedCat] = useState("semiconductors");

  function openIndustry(cat: string) {
    setSelectedCat(cat);
    setTab("industry");
  }

  return (
    <div className="page-stack min-w-0 grid-cols-1">
      <header className="page-header">
        <p className="desk-kicker mb-1.5">Trade statistics × listed equity</p>
        <h1 className="page-title flex items-center gap-2">
          <Ship className="size-7 text-desk-gold" />
          {t("export.desk.title", lang)}
        </h1>
        <p className="page-lead">
          관세청·OECD·World Bank 수출입 통계와 실제 시장 시세를 비교합니다. 품목은 HS 기준이며,
          출처별 공표 시차와 연결 상태를 함께 표시합니다.
        </p>
        <LiveTape />
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <label className="inline-flex items-center gap-1.5">
            <Switch
              aria-label="영문 표제 사용"
              checked={lang === "en"}
              onCheckedChange={(v) => setLang(v ? "en" : "ko")}
            />
            EN
          </label>
          <select
            aria-label="차트 기간"
            className="min-h-11 rounded-md border border-border bg-background px-2"
            value={settings.range}
            onChange={(e) => patch({ range: e.target.value as typeof settings.range })}
          >
            {(["1Y", "3Y", "5Y", "10Y", "MAX"] as const).map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <select
            aria-label="차트 표시 방식"
            className="min-h-11 rounded-md border border-border bg-background px-2"
            value={settings.chartMode}
            onChange={(e) => patch({ chartMode: e.target.value as typeof settings.chartMode })}
          >
            <option value="indexed">Indexed=100</option>
            <option value="absolute">Absolute</option>
            <option value="growth">Growth</option>
            <option value="krw">Export KRW</option>
          </select>
          <select
            aria-label="수출 시계열 계산 방식"
            className="min-h-11 rounded-md border border-border bg-background px-2"
            value={settings.levelSeries}
            onChange={(e) => patch({ levelSeries: e.target.value as typeof settings.levelSeries })}
          >
            <option value="roll12">12M 누적 (기본)</option>
            <option value="wad">일평균</option>
            <option value="raw">원시계열 (계절성)</option>
          </select>
          <select
            aria-label="시가총액 비교 범위"
            className="min-h-11 rounded-md border border-border bg-background px-2"
            value={settings.universeN}
            onChange={(e) => patch({ universeN: Number(e.target.value) as 100 | 200 })}
          >
            <option value={100}>Top 100</option>
            <option value={200}>Top 200</option>
          </select>
          <RefreshDataButton />
        </div>
        <ConnectionSummary />
      </header>

      <Tabs className="min-w-0 w-full" value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto w-full max-w-full flex-wrap justify-start">
          {TABS.map((tb) => (
            <TabsTrigger
              key={tb.id}
              value={tb.id}
              className="min-h-11 whitespace-normal text-left text-[11px]"
            >
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

const PROVIDER_LABELS: Record<ExportProviderStatus["state"], string> = {
  ok: "연결 정상",
  partial: "일부 관측",
  stale: "이전 관측",
  empty: "관측 없음",
  "missing-key": "서버 키 미등록",
  "invalid-key": "키 인증 실패",
  "rate-limited": "요청 제한",
  unavailable: "연결 실패",
  unverified: "미검증",
};
const PROVIDER_QUERY_KINDS = [
  "export-category",
  "export-industry-px",
  "export-category-catalog",
  "export-motie-release",
];

function useDeskMacro() {
  const macro = useServerExportMacro();
  const index = useExportDeskStore((s) => s.indexImported);
  const fx = useExportDeskStore((s) => s.fxImported);
  const currentMonth = kstYmd().slice(0, 7);
  const importedPoints = (rows: typeof index) =>
    rows
      .filter((r) => r.date.slice(0, 7) < currentMonth && Number.isFinite(r.close) && r.close > 0)
      .map((r) => ({ date: r.date, value: r.close }));
  const importedIndex = importedPoints(index);
  const importedFx = importedPoints(fx);
  const hasImports = importedIndex.length > 0 || importedFx.length > 0;
  const data =
    macro.data || hasImports
      ? {
          kospi: importedIndex.length ? importedIndex : (macro.data?.kospi ?? []),
          fx: importedFx.length ? importedFx : (macro.data?.fx ?? []),
          spotUsdKrw: macro.data?.spotUsdKrw ?? 0,
          source: importedIndex.length
            ? `가져온 KOSPI CSV · ${index.at(-1)?.sourceFile}`
            : (macro.data?.source ?? "시세 미확보"),
          fxSource: importedFx.length
            ? `가져온 USD/KRW CSV · ${fx.at(-1)?.sourceFile}`
            : (macro.data?.fxSource ?? "환율 미확보"),
          spotFxSource: macro.data?.spotFxSource ?? null,
          fetchedAt: macro.data?.fetchedAt ?? "",
          providers: macro.data?.providers ?? [],
        }
      : undefined;
  return { ...macro, data };
}

function useProviderStatuses(): ExportProviderStatus[] {
  const trade = useLiveTrade();
  const macro = useDeskMacro();
  const client = useQueryClient();
  const categoryFetchCount = useIsFetching({
    predicate: (q) => PROVIDER_QUERY_KINDS.includes(String(q.queryKey[0])),
  });
  return useMemo(() => {
    const category = client
      .getQueriesData<{
        providers?: ExportProviderStatus[];
        provider?: ExportProviderStatus;
        items?: CategoryCatalogItem[];
      }>({
        predicate: (q) => PROVIDER_QUERY_KINDS.includes(String(q.queryKey[0])),
      })
      .flatMap(([, value]) => {
        if (value?.provider) return [value.provider];
        if (!value?.items) return value?.providers ?? [];
        const providers = new Map<string, ExportProviderStatus>();
        for (const item of value.items) {
          for (const provider of item.providers) {
            const previous = providers.get(provider.id);
            // A connected HS4 source must not become "disconnected" merely
            // because another category requests a different unsupported level.
            if (!previous || provider.recordCount > 0 || previous.recordCount === 0)
              providers.set(provider.id, provider);
          }
        }
        return [...providers.values()];
      });
    return [
      ...new Map(
        [...(trade.data?.providers ?? []), ...(macro.data?.providers ?? []), ...category].map(
          (p) => [p.id, p],
        ),
      ).values(),
    ];
  }, [trade.data, macro.data?.providers, client, categoryFetchCount]);
}

function RefreshDataButton() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  async function refresh() {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith("export-"),
        refetchType: "all",
      });
    } finally {
      setRefreshing(false);
    }
  }
  return (
    <Button
      variant="outline"
      className="min-h-11 gap-1.5"
      disabled={refreshing}
      onClick={() => void refresh()}
    >
      <RefreshCw
        aria-hidden="true"
        className={cn("size-3.5", refreshing && "animate-spin motion-reduce:animate-none")}
      />
      {refreshing ? "자료 확인 중" : "자료 새로고침"}
    </Button>
  );
}

function ConnectionSummary() {
  const live = useLiveTrade();
  const macro = useDeskMacro();
  const providers = useProviderStatuses();
  const imported = useExportDeskStore((s) => s.observations);
  return (
    <div
      className="mt-3 space-y-1 text-[11px] text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      {(live.isFetching || macro.isFetching) && (
        <p>공식 통계와 시장 시세를 확인하고 있습니다. 연결이 끝난 자료부터 표시합니다.</p>
      )}
      {(live.isError || macro.isError) && (
        <p className="text-desk-copper">
          일부 자료 요청에 실패했습니다. 자료 새로고침으로 다시 확인할 수 있습니다.
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {providers
          .filter((p) =>
            [
              "customs.total",
              "customs.item",
              "customs.public-item",
              "customs.country",
              "fred.exports",
              "oecd.exports",
              "worldbank-exports",
              "trade.cache",
              "comtrade.total",
              "naver.kospi",
              "bok.fx",
            ].includes(p.id),
          )
          .map((p) => (
            <Badge
              key={p.id}
              variant="outline"
              title={p.message}
              className="max-w-full whitespace-normal text-[10px]"
            >
              {p.name} · {PROVIDER_LABELS[p.state]}
              {p.asOf ? ` · ${p.asOf}` : ""}
            </Badge>
          ))}
      </div>
      {imported.length > 0 && (
        <p>
          가져온 전국 자료는 같은 품목의 서버 자료보다 우선합니다. 가장 최근 파일·분류·공표본 하나를
          사용하며 빈 월을 다른 파일로 채우지 않습니다. 지역 자료는 전국 합계에 넣지 않습니다.
        </p>
      )}
    </div>
  );
}

function isNationalObservation(o: TradeObservation): boolean {
  return (
    !o.geo?.trim() ||
    /^(?:national|kr|kor|korea|republic of korea|대한민국|한국|전국|전체|총계)$/i.test(o.geo.trim())
  );
}

function useAllObservations(categoryId?: string): TradeObservation[] {
  const imported = useExportDeskStore((s) => s.observations);
  const live = useLiveTrade();
  const category = useTradeCategory(categoryId);
  const client = useQueryClient();
  const categoryFetchCount = useIsFetching({ queryKey: ["export-category"] });
  return useMemo(() => {
    const histories = new Map<string, TradeObservation[]>();
    for (const [key, data] of client.getQueriesData<{ observations: TradeObservation[] }>({
      queryKey: ["export-category"],
    })) {
      const id = typeof key[1] === "string" ? key[1] : "";
      const exact = (data?.observations ?? []).filter(
        (o) => o.categoryId === id && isNationalObservation(o),
      );
      if (exact.length) histories.set(id, exact);
    }
    const current = (category.data?.observations ?? []).filter(
      (o) => o.categoryId === categoryId && isNationalObservation(o),
    );
    if (categoryId && current.length) histories.set(categoryId, current);
    const server = [
      ...(live.data?.observations ?? []).filter((o) => !histories.has(o.categoryId)),
      ...[...histories.values()].flat(),
    ].filter(isNationalObservation);
    const national = imported.filter(isNationalObservation).map((o) => ({
      ...o,
      geo: undefined,
      categoryId:
        (o.classification === "HS" || o.classification === "HSK") &&
        /^(?:\d{2}|\d{4}|\d{6}|\d{10})$/.test(o.categoryId)
          ? `hs${o.categoryId.length}:${o.categoryId}`
          : o.categoryId,
    }));
    for (const proxy of CORE20_HS_PROXY) {
      if (national.some((o) => o.categoryId === proxy.key)) continue;
      const members = national.filter((o) =>
        proxy.codes.some((code) => o.categoryId === `hs${code.length}:${code}`),
      );
      const latest = members.at(-1);
      if (!latest) continue;
      const dataset = members.filter(
        (o) =>
          o.sourceFile === latest.sourceFile &&
          o.classification === latest.classification &&
          (o.vintage ?? "") === (latest.vintage ?? ""),
      );
      for (const period of new Set(dataset.map((o) => o.period))) {
        const byCode: Record<string, number> = {};
        for (const o of dataset.filter((o) => o.period === period))
          byCode[o.categoryId.split(":")[1]!] = o.valueUsd;
        national.push({
          ...latest,
          categoryId: proxy.key,
          categoryName: proxy.label,
          period,
          valueUsd: aggregateProxy(byCode, proxy.codes) ?? NaN,
          sourceFile: latest.sourceFile,
        });
      }
    }
    const categories = new Set(national.map((o) => o.categoryId));
    const chosen: TradeObservation[] = server.filter((o) => !categories.has(o.categoryId));
    for (const categoryId of categories) {
      const rows = national.filter((o) => o.categoryId === categoryId);
      const latest = rows.at(-1)!;
      const sameDataset = rows.filter(
        (o) =>
          o.sourceFile === latest.sourceFile &&
          o.classification === latest.classification &&
          (o.vintage ?? "") === (latest.vintage ?? ""),
      );
      chosen.push(...new Map(sameDataset.map((o) => [o.period, o])).values());
    }
    return chosen.map((o) => ({ ...o, geo: undefined }));
  }, [imported, live.data, category.data, categoryId, client, categoryFetchCount]);
}

type CategoryCard = Omit<CategoryCatalogItem, "classification"> & {
  classification: TradeObservation["classification"] | null;
  imported: boolean;
};

/** Summaries feed cards only; they are never added to an analytical time series. */
function useCategoryCards(
  observations: TradeObservation[],
  catalog?: CategoryCatalog,
  motie?: MotieSnapshot,
) {
  const imported = useExportDeskStore((s) => s.observations);
  return useMemo(() => {
    const cards = new Map<string, CategoryCard>(
      (catalog?.items ?? []).map((item) => [item.id, { ...item, imported: false }]),
    );
    if (
      motie?.release &&
      motie.provider.configured &&
      motie.provider.recordCount > 0 &&
      ["ok", "partial", "stale"].includes(motie.provider.state)
    ) {
      for (const item of motie.release.items) {
        const row = motie.observations.find(
          (o) =>
            o.categoryId === item.categoryId &&
            o.period === motie.release!.period &&
            o.valueUsd === item.valueUsd &&
            o.classification === "MTI" &&
            Number.isFinite(o.valueUsd) &&
            o.valueUsd >= 0,
        );
        if (!row) continue;
        const saved = cards.get(item.categoryId);
        if (saved?.current && saved.current.period > row.period) continue;
        cards.set(item.categoryId, {
          id: item.categoryId,
          label: item.label,
          current: { period: row.period, valueUsd: row.valueUsd },
          previousYoY: null,
          yoyPct: item.yoyPct != null && Number.isFinite(item.yoyPct) ? item.yoyPct : null,
          state: motie.provider.state === "stale" ? "stale" : "ok",
          count: 1,
          source: row.sourceFile,
          classification: "MTI",
          providers: [motie.provider],
          verifiedAt: motie.provider.checkedAt,
          freshUntil: null,
          retryAt: motie.provider.retryAt ?? null,
          imported: false,
        });
      }
    }
    const importedIds = new Set(
      imported
        .filter(isNationalObservation)
        .map((o) =>
          (o.classification === "HS" || o.classification === "HSK") &&
          /^(?:\d{2}|\d{4}|\d{6}|\d{10})$/.test(o.categoryId)
            ? `hs${o.categoryId.length}:${o.categoryId}`
            : o.categoryId,
        ),
    );
    for (const proxy of CORE20_HS_PROXY) {
      if (proxy.codes.some((code) => importedIds.has(`hs${code.length}:${code}`)))
        importedIds.add(proxy.key);
    }
    const byCategory = new Map<string, TradeObservation[]>();
    for (const row of observations) {
      if (!isNationalObservation(row) || !Number.isFinite(row.valueUsd) || row.valueUsd < 0)
        continue;
      const rows = byCategory.get(row.categoryId) ?? [];
      rows.push(row);
      byCategory.set(row.categoryId, rows);
    }
    for (const id of new Set([...byCategory.keys(), ...importedIds])) {
      const rows = (byCategory.get(id) ?? []).sort((a, b) => a.period.localeCompare(b.period));
      const last = rows.at(-1);
      const saved = cards.get(id);
      const isImported = importedIds.has(id);
      // A chosen import owns its entire category, including missing months.
      // Otherwise select one complete source dataset by its newest month.
      if (!isImported && saved?.current && (!last || saved.current.period >= last.period)) continue;
      const sameDataset = last
        ? rows.filter(
            (row) =>
              row.sourceFile === last.sourceFile &&
              row.classification === last.classification &&
              (row.vintage ?? "") === (last.vintage ?? ""),
          )
        : [];
      const previous = sameDataset.find((row) => row.period === addMonths(last?.period, -12));
      cards.set(id, {
        id,
        label: last?.categoryName ?? saved?.label ?? id,
        current: last ? { period: last.period, valueUsd: last.valueUsd } : null,
        previousYoY: previous ? { period: previous.period, valueUsd: previous.valueUsd } : null,
        yoyPct:
          last && previous && previous.valueUsd > 0
            ? (last.valueUsd / previous.valueUsd - 1) * 100
            : null,
        state: last ? "ok" : "unavailable",
        count: sameDataset.length,
        source: last?.sourceFile ?? null,
        classification: last?.classification ?? null,
        providers: isImported ? [] : (saved?.providers ?? []),
        verifiedAt: isImported ? null : (saved?.verifiedAt ?? null),
        freshUntil: isImported ? null : (saved?.freshUntil ?? null),
        retryAt: isImported ? null : (saved?.retryAt ?? null),
        imported: isImported,
      });
    }
    return cards;
  }, [observations, catalog, motie, imported]);
}

function categoryCardState(card: CategoryCard | undefined, loading: boolean): string {
  if (card?.current) return card.state === "stale" ? "이전 공식 자료" : "관측 확보";
  if (loading || !card || card.state === "pending") return "조회 대기";
  return "자료 미확보";
}

function categoryCardReason(card: CategoryCard | undefined): string {
  if (card?.imported) return "가져온 파일의 전국 관측을 사용합니다.";
  return (
    card?.providers
      .filter((p) => p.id !== "trade.cache")
      .map((p) => `${p.name}: ${p.message}`)
      .join(" · ") || "공식 저장 자료를 확인하고 있습니다."
  );
}

function MotieReleaseBadge({ query }: { query: ReturnType<typeof useMotieRelease> }) {
  const snapshot = query.data;
  const release = snapshot?.release;
  const provider = snapshot?.provider;
  const verified = Boolean(
    release &&
    provider?.configured &&
    provider.recordCount > 0 &&
    snapshot?.observations.length &&
    ["ok", "partial", "stale"].includes(provider.state),
  );
  const label = query.isLoading
    ? "산업부 공식 속보 확인 중"
    : release
      ? verified
        ? `산업부 공식 속보 · ${provider?.state === "stale" ? "이전 자료" : "연결 정상"} · ${release.period}${release.provisional ? " · 잠정" : ""}`
        : `산업부 속보 원문 연결 · 수치 미검증 · ${release.period}`
      : `산업부 공식 속보 · ${provider ? PROVIDER_LABELS[provider.state] : "연결 실패"}`;
  const className = cn(
    "rounded px-1.5 py-0.5 font-medium",
    verified && provider?.state !== "stale"
      ? "bg-emerald-500/15 text-emerald-300"
      : "bg-amber-500/15 text-amber-200",
  );
  return release ? (
    <a
      className={cn(className, "min-h-11 inline-flex items-center hover:underline")}
      href={release.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${release.title} · ${provider?.message ?? "공식 원문"}`}
      data-testid="export-motie-release-status"
    >
      {label}
    </a>
  ) : (
    <span className={className} title={provider?.message} data-testid="export-motie-release-status">
      {label}
    </span>
  );
}

function useExportSeries(categoryId = "TOTAL") {
  const alignment = useExportDeskStore((s) => s.settings.alignment);
  const all = useAllObservations(categoryId);
  return useMemo(() => {
    const real = all.filter((o) => o.categoryId === categoryId);
    assertNoSyntheticLeak(real);
    const used = completeMonthlyObservations(real);
    return alignByReleaseDate(
      [...used].sort((a, b) => a.period.localeCompare(b.period)),
      alignment,
    );
  }, [all, categoryId, alignment]);
}

function LiveTape() {
  const live = useLiveTrade();
  const exports = useExportSeries("TOTAL");
  const values = exports.map((e) => e.valueUsd);
  const yoy = calculateYoYGrowth(values);
  const last = exports.at(-1);
  const prev = exports.at(-2);
  const y = yoy.at(-1);
  const mom = last && prev && prev.valueUsd ? (last.valueUsd / prev.valueUsd - 1) * 100 : null;
  const roll = calculateRolling12MSum(values).at(-1);
  const imp = live.data?.imports ?? [];
  const matchedImp = last ? imp.find((i) => i.period === last.period) : undefined;
  const hasImportedTotal = useExportDeskStore((s) =>
    s.observations.some((o) => o.categoryId === "TOTAL" && isNationalObservation(o)),
  );
  const bal = last && matchedImp && !hasImportedTotal ? last.valueUsd - matchedImp.valueUsd : null;
  const macro = useDeskMacro();
  const k = macro.data?.kospi.at(-1);
  return (
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <Kpi
        label="총수출 (전국 · 월간)"
        value={last ? formatUsdBn(last.valueUsd) : live.isLoading ? "수집 중" : "N/A"}
        sub={last ? `${last.period} · ${last.sourceFile}` : "—"}
      />
      <Kpi
        label="YoY"
        value={y != null && Number.isFinite(y) ? `${y.toFixed(1)}%` : "N/A"}
        tone={y != null && Number.isFinite(y) ? (y >= 0 ? "up" : "down") : undefined}
      />
      <Kpi
        label="MoM"
        value={mom != null && Number.isFinite(mom) ? `${mom.toFixed(1)}%` : "N/A"}
        tone={mom != null && Number.isFinite(mom) ? (mom >= 0 ? "up" : "down") : undefined}
      />
      <Kpi
        label="12M 누적"
        value={roll != null && Number.isFinite(roll) ? formatUsdBn(roll) : "N/A"}
      />
      <Kpi
        label="무역수지"
        value={bal != null ? formatUsdBn(bal) : "N/A"}
        sub={
          hasImportedTotal
            ? "가져온 수출과 서버 수입은 합산하지 않음"
            : matchedImp
              ? `수입 ${formatUsdBn(matchedImp.valueUsd)}`
              : "수입 대기"
        }
        tone={bal != null && Number.isFinite(bal) ? (bal >= 0 ? "up" : "down") : undefined}
      />
      <Kpi
        label="KOSPI"
        value={k ? k.value.toFixed(0) : "N/A"}
        sub={
          k
            ? `${k.date.slice(0, 7)} · 완료 월 관측`
            : macro.isFetching
              ? "시세 확인 중"
              : macro.data?.source
        }
      />
    </div>
  );
}

function clipRange<T extends { period?: string; date?: string }>(rows: T[], range: string): T[] {
  if (range === "MAX" || rows.length === 0) return rows;
  const years = range === "1Y" ? 1 : range === "3Y" ? 3 : range === "10Y" ? 10 : 5;
  const ym =
    rows
      .map((r) => r.period ?? r.date ?? "")
      .sort()
      .at(-1)
      ?.slice(0, 7) || kstYmd().slice(0, 7);
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
  const exports = useExportSeries("TOTAL");
  const live = useLiveTrade();
  const macro = useDeskMacro();
  const kospiMonth = useMemo(
    () =>
      resampleDailyToMonthEnd(
        (macro.data?.kospi ?? []).map((p) => ({ date: p.date, value: p.value })),
      ),
    [macro.data?.kospi],
  );

  const fullChart = useMemo(() => {
    const values = exports.map((e) => e.valueUsd);
    const wad = exports.map(
      (e) => calculateWorkingDayAdjusted(e.valueUsd, e.workingDays ?? 0) ?? NaN,
    );
    const roll = calculateRolling12MSum(values);
    const yoy = calculateYoYGrowth(values);
    const mom = calculateMomentum(values, 3);
    const level =
      settings.levelSeries === "raw" ? values : settings.levelSeries === "wad" ? wad : roll;
    const byP = new Map(kospiMonth.map((k) => [k.period, k.value]));
    const exportByP = new Map(exports.map((e, i) => [e.period, i]));
    const periods = [
      ...new Set([...exports.map((e) => e.period), ...kospiMonth.map((k) => k.period)]),
    ].sort();
    const monthlyKrw = exports.map((e) => {
      const fx = fxRateForPeriod(e.period, macro.data?.fx ?? [], 0);
      return fx == null ? NaN : (convertUsdKrw(e.valueUsd, fx) ?? NaN);
    });
    const krwLevel =
      settings.levelSeries === "roll12"
        ? calculateRolling12MSum(monthlyKrw)
        : settings.levelSeries === "wad"
          ? monthlyKrw.map(
              (v, i) => calculateWorkingDayAdjusted(v, exports[i]?.workingDays ?? 0) ?? NaN,
            )
          : monthlyKrw;
    const aligned = periods.map((period) => {
      const i = exportByP.get(period);
      return {
        period,
        exp: i == null ? NaN : level[i]!,
        expKrw: i == null ? NaN : krwLevel[i]!,
        kospi: byP.get(period) ?? NaN,
        yoy: i == null ? NaN : yoy[i]!,
        mom: i == null ? NaN : mom[i]!,
      };
    });
    const clipped = clipRange(aligned, settings.range).filter(
      (r) => Number.isFinite(r.exp) || Number.isFinite(r.kospi),
    );
    // Preserve the visible range's index base in the pre-roll history as well.
    const commonBase = clipped.find(
      (r) => Number.isFinite(r.exp) && r.exp !== 0 && Number.isFinite(r.kospi) && r.kospi !== 0,
    );
    const expBase =
      commonBase?.exp ?? clipped.find((r) => Number.isFinite(r.exp) && r.exp !== 0)?.exp;
    const kBase =
      commonBase?.kospi ?? clipped.find((r) => Number.isFinite(r.kospi) && r.kospi !== 0)?.kospi;
    const expIdx = aligned.map((r) => (expBase ? (r.exp / expBase) * 100 : NaN));
    const kIdx = aligned.map((r) => (kBase ? (r.kospi / kBase) * 100 : NaN));
    const kYoy = calculateYoYGrowth(
      aligned.map((r) => r.kospi),
      12,
    );
    return aligned.map((r, i) => {
      return {
        ...r,
        exp: numOrNull(r.exp),
        kospi: numOrNull(r.kospi),
        yoy: numOrNull(r.yoy),
        mom: numOrNull(r.mom),
        expIdx: numOrNull(expIdx[i]),
        kIdx: numOrNull(kIdx[i]),
        kYoy: numOrNull(kYoy[i]),
        expKrw: numOrNull(r.expKrw),
      };
    });
  }, [
    exports,
    kospiMonth,
    settings.levelSeries,
    settings.range,
    macro.data?.fx,
    macro.data?.spotUsdKrw,
  ]);

  const chart = useMemo(() => clipRange(fullChart, settings.range), [fullChart, settings.range]);
  const dualRow = (r: (typeof fullChart)[number]) => ({
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
  });

  const last = chart.filter((r) => r.exp != null).at(-1);
  const lastK = chart.filter((r) => r.kospi != null).at(-1);
  const totalSource =
    [
      ...new Set(
        exports
          .filter((row) => Number.isFinite(row.valueUsd))
          .map((row) => row.sourceFile)
          .filter(Boolean),
      ),
    ].join(" · ") || "관측 미확보";

  return (
    <section className="desk-card desk-card-navy p-4 space-y-4">
      <h2 className="text-lg font-semibold">{t("export.total.title", lang)}</h2>
      {settings.levelSeries === "raw" && (
        <p className="text-xs text-desk-copper">{t("export.seasonal", lang)}</p>
      )}
      {settings.levelSeries === "wad" && !exports.some((e) => (e.workingDays ?? 0) > 0) && (
        <p className="text-xs text-desk-copper">
          이 수출 자료는 조업일수를 제공하지 않아 일평균 수출을 계산할 수 없습니다. 원시계열 또는
          12M 누적을 선택하세요.
        </p>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <Kpi
          label="수출 (선택 시계열)"
          value={last?.exp != null ? formatUsdBn(last.exp) : "N/A"}
          sub={last?.period ?? "—"}
        />
        <Kpi label="YoY" value={last?.yoy != null ? `${last.yoy.toFixed(1)}%` : "N/A"} />
        <Kpi label="3M momentum" value={last?.mom != null ? `${last.mom.toFixed(1)}%` : "N/A"} />
        <Kpi
          label="KOSPI"
          value={lastK?.kospi != null ? lastK.kospi.toFixed(0) : "N/A"}
          sub={macro.data?.source ?? ""}
        />
      </div>
      {exports.length === 0 && <EmptyExport />}
      {chart.length === 0 ? (
        exports.length > 0 || (macro.data?.kospi.length ?? 0) > 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            시계열은 있으나 선택한 기간에 그릴 점이 없습니다. 기간을 MAX로 바꿔 보세요.
          </div>
        ) : null
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block size-2 rounded-full bg-desk-gold" /> 수출
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block size-2 rounded-full" style={{ background: "#3b82f6" }} />{" "}
              KOSPI
            </span>
            <span>드래그로 이동 · 휠로 확대</span>
          </div>
          <ExportDualChart
            sharedScale={settings.chartMode === "indexed" || settings.chartMode === "growth"}
            data={chart.map(dualRow)}
            history={fullChart.map(dualRow)}
            aName={
              settings.chartMode === "growth"
                ? "수출 YoY"
                : settings.chartMode === "krw"
                  ? "수출 KRW"
                  : settings.chartMode === "absolute"
                    ? "수출 USD"
                    : "수출=100"
            }
            bName={
              settings.chartMode === "growth"
                ? "KOSPI YoY"
                : settings.chartMode === "absolute"
                  ? "KOSPI"
                  : "KOSPI=100"
            }
            source={`수출 ${totalSource} · KOSPI ${macro.data?.source ?? "—"}`}
            asOf={macro.data?.fetchedAt ?? null}
            mode={
              settings.chartMode === "growth"
                ? "월간 · 전년 대비 %"
                : settings.chartMode === "absolute"
                  ? "월간 · 수출 USD(좌) / KOSPI(우)"
                  : settings.chartMode === "krw"
                    ? "월간 · 원화 환산"
                    : "월간 · 기준=100"
            }
          />
        </div>
      )}
      <Provenance
        source={totalSource}
        period={`${chart[0]?.period ?? "—"} ~ ${chart.at(-1)?.period ?? "—"}`}
        ingested={live.data?.source.fetchedAt ?? "—"}
        taxonomy={`${getCore20().taxonomyVersion} (미검증 참고 분류)`}
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
    <div className="min-w-0 max-w-full rounded-lg border border-border bg-card/60 px-3 py-2">
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
  if (!Number.isFinite(v)) return "N/A";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}bn`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}m`;
  return `$${v.toLocaleString("en-US")}`;
}

function LiveNewsStrip() {
  const news = useTradeNews();
  const items = news.data ?? [];
  if (!items.length) return null;
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold text-muted-foreground">
        수출 헤드라인 (원문 링크 · 수치는 차트에 넣지 않음)
      </div>
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
      {!live.isFetching && (
        <div className="mt-3">
          <Button variant="outline" onClick={() => void live.refetch()} className="min-h-11">
            수출 자료 다시 확인
          </Button>
        </div>
      )}
    </div>
  );
}

function Core20Panel({ onOpen }: { onOpen: (cat: string) => void }) {
  const allItems = getCore20().items as {
    key: string;
    ko: string;
    en: string;
    subItems: string[];
    addedIn2026Revision?: boolean;
  }[];
  const [rev, setRev] = useState<"20" | "15">("20");
  const [focus, setFocus] = useState("semiconductors");
  const [picked, setPicked] = useState<string[]>([
    "semiconductors",
    "automobiles",
    "ships",
    "petroleum_products",
  ]);
  const items = rev === "20" ? allItems : allItems.filter((it) => !it.addedIn2026Revision);
  const lang = useExportDeskStore((s) => s.lang);
  const all = useAllObservations(focus);
  const category = useTradeCategory(focus);
  const exposures = useExportDeskStore((s) => s.exposures);
  const settings = useExportDeskStore((s) => s.settings);
  const live = useLiveTrade();
  const catalog = useTradeCategoryCatalog();
  const motie = useMotieRelease();
  const cards = useCategoryCards(all, catalog.data, motie.data);
  const totals = all.filter((o) => o.categoryId === "TOTAL");
  const observed = all.filter((o) => Number.isFinite(o.valueUsd) && o.valueUsd >= 0);
  const focusedRows = observed.filter((o) => o.categoryId === focus);
  const focusedPeriods = [...new Set(focusedRows.map((o) => o.period))].sort();
  const focusedItem = allItems.find((it) => it.key === focus);
  const focusedLabel = focusedItem ? (lang === "en" ? focusedItem.en : focusedItem.ko) : focus;
  const focusedSource = [...new Set(focusedRows.map((o) => o.sourceFile))].join(" · ");
  const observedItemCount = items.filter((it) => cards.get(it.key)?.current).length;
  const customsProviders = (category.data?.providers ?? live.data?.providers ?? []).filter(
    (p) => p.id === "customs.item" || p.id === "customs.public-item",
  );
  const customsProvider =
    customsProviders.find(
      (p) => p.recordCount > 0 && ["ok", "partial", "stale"].includes(p.state),
    ) ??
    customsProviders.find((p) => p.id === "customs.public-item") ??
    customsProviders[0];
  const amountSeries = items
    .filter((it) => picked.includes(it.key))
    .map((it) => ({
      id: it.key,
      name: lang === "en" ? it.en : it.ko,
      points: all
        .filter((o) => o.categoryId === it.key && Number.isFinite(o.valueUsd) && o.valueUsd >= 0)
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
          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-medium text-emerald-300">
            {focusedSource ||
              (category.isFetching ? "선택 품목 출처 확인 중" : "선택 품목 관측 미확보")}
          </span>
          <MotieReleaseBadge query={motie} />
          <span
            className={cn(
              "rounded px-1.5 py-0.5 font-medium",
              customsProvider?.recordCount && customsProvider.state === "ok"
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-amber-500/15 text-amber-200",
            )}
          >
            {customsProvider
              ? `${customsProvider.name} · ${PROVIDER_LABELS[customsProvider.state]}${customsProvider.asOf ? ` · ${customsProvider.asOf}` : ""}`
              : category.isFetching
                ? "관세청 품목 · 조회 중"
                : category.isError
                  ? "관세청 품목 · 연결 실패"
                  : "관세청 품목 · 조회 결과 없음"}
          </span>
          <span className="rounded border border-border px-1.5 py-0.5">
            품목 정의·출처 개별 표시
          </span>
        </div>
        각 카드는 실제 자료의 MTI·HS 분류와 기준월을 표시합니다. 산업부 속보에서 수치가 확인된
        품목만 공식 MTI 관측으로 표시하며, HS 대용 품목과 구분합니다. 목록 토글은 참고 품목만 바꾸며
        금액을 만들지 않습니다. 조회 대기와 자료 미확보를 구분하고, 부분 품목 합을 총수출 100%로
        늘려 맞추지 않습니다.
      </div>
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className={cn(
            "min-h-11 rounded-md px-2 text-xs",
            rev === "20" ? "bg-desk-gold/20 text-desk-gold" : "bg-muted text-muted-foreground",
          )}
          onClick={() => setRev("20")}
        >
          참고 20개
        </button>
        <button
          type="button"
          className={cn(
            "min-h-11 rounded-md px-2 text-xs",
            rev === "15" ? "bg-desk-gold/20 text-desk-gold" : "bg-muted text-muted-foreground",
          )}
          onClick={() => setRev("15")}
        >
          참고 15개
        </button>
        <span
          className="self-center text-[11px] text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          참고 목록 {items.length}개 · 관측 확보 {observedItemCount}/{items.length}개 · 선택 이력{" "}
          {focusedLabel}
          {focusedPeriods.length
            ? ` · 최신 ${focusedPeriods.at(-1)} · ${focusedPeriods.length}개월`
            : category.isFetching
              ? " · 이력 조회 중"
              : " · 관측 미확보"}
        </span>
      </div>
      <p
        role="status"
        className="text-xs text-muted-foreground"
        data-testid="export-category-catalog-status"
      >
        {catalog.isLoading
          ? "전체 품목의 공식 저장 자료를 불러오고 있습니다. 품목별로 클릭하지 않아도 자동 조회합니다."
          : catalog.isError
            ? "전체 품목 요약 조회에 실패했습니다. 확보한 자료는 유지하며 자료 새로고침으로 다시 확인할 수 있습니다."
            : catalog.warmingPaused
              ? "일부 품목이 조회 대기 중입니다. 자료 새로고침으로 남은 품목을 다시 확인할 수 있습니다."
              : catalog.data?.pending.length
                ? `공식 자료 자동 확인 중 · 남은 품목 ${catalog.data.pending.length}개. 확보한 값부터 표시합니다.`
                : "전체 품목의 공식 자료 확인을 마쳤습니다. 미확보 품목은 카드에서 사유를 확인할 수 있습니다."}
      </p>
      {category.isFetching && (
        <p role="status" className="text-xs text-muted-foreground">
          선택 품목의 월별 이력을 확인하고 있습니다.
        </p>
      )}
      {category.data?.providers?.map((p) => (
        <p key={p.id} className="text-[11px] text-muted-foreground">
          {p.name} · {PROVIDER_LABELS[p.state]} · {p.message}
        </p>
      ))}
      {amountSeries.length > 0 ? (
        <ExportAmountChart
          series={amountSeries}
          focusId={focusId}
          source={
            [
              ...new Set(
                all
                  .filter((o) => picked.includes(o.categoryId) && Number.isFinite(o.valueUsd))
                  .map((o) => o.sourceFile),
              ),
            ].join(" · ") ||
            live.data?.source.items ||
            "HS 품목 출처 확인 중"
          }
          asOf={category.data?.providers?.at(-1)?.checkedAt ?? live.data?.source.fetchedAt ?? null}
        />
      ) : (
        <div className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          {category.isFetching || live.isLoading
            ? "HS 품목 시계열 수집 중"
            : "선택한 품목은 비교 가능한 월별 관측이 2개 미만입니다. 아래 카드에서 확인된 단월 금액과 출처를 볼 수 있습니다."}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        최대 6개 오버레이. 카드는 최신 공식 요약을, 오버레이는 확보한 월별 이력을 표시합니다. MTI
        단월 속보를 HS 이력에 이어 붙이지 않습니다. 카드를 누르면 산업 × 주가 비교로 이동합니다.
        고저 마커는 포커스 품목(마지막에 고른 항목)에만 그립니다.
      </p>
      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => {
          const card = cards.get(it.key);
          const last = card?.current;
          const yoy = card?.yoyPct != null ? `${card.yoyPct.toFixed(1)}%` : "동월 관측 미확보";
          const total = last ? totals.find((t) => t.period === last.period) : undefined;
          const share =
            last && total && card?.source === total.sourceFile && total.valueUsd > 0
              ? (last.valueUsd / total.valueUsd) * 100
              : null;
          const stateLabel = categoryCardState(card, catalog.isLoading);
          const reason = categoryCardReason(card);
          const provider = card?.providers.find(
            (p) => p.recordCount > 0 && p.asOf === last?.period && p.id !== "trade.cache",
          );
          const mapped = exposures.filter(
            (e) => e.exportCategoryId === it.key && e.active !== false,
          );
          const verified = mapped.filter(
            (e) => isEvidenceBackedExposure(e) && e.mappingConfidence >= settings.minConfidence,
          );
          const proxy = proxyForKey(it.key);
          const on = picked.includes(it.key);
          return (
            <div
              key={it.key}
              data-testid={`export-category-card-${it.key}`}
              data-catalog-state={card?.state ?? "pending"}
              className={cn(
                "desk-card desk-card-teal min-w-0 max-w-full p-3 text-left",
                on && "ring-1 ring-desk-gold/50",
              )}
            >
              <button
                type="button"
                onClick={() => onOpen(it.key)}
                className="w-full min-w-0 max-w-full text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-semibold">{lang === "en" ? it.en : it.ko}</div>
                  {it.addedIn2026Revision && (
                    <span className="text-[10px] text-desk-gold">추가 참고 품목</span>
                  )}
                </div>
                <div className="mt-1 text-lg tabular font-semibold">
                  {last ? formatUsdBn(last.valueUsd) : stateLabel}
                </div>
                {last && (
                  <div className="text-[10px] text-muted-foreground">기준 {last.period}</div>
                )}
                <div className="text-[11px] text-muted-foreground">
                  {last ? `YoY ${yoy}` : "공식 관측 확인 필요"}
                  {share != null
                    ? ` · 동일 출처 총수출 대비 ${share.toFixed(1)}%`
                    : last
                      ? " · 동일 기준 총수출 미확보"
                      : ""}
                </div>
                <div
                  className="mt-1 min-w-0 max-w-full truncate text-[10px] text-muted-foreground"
                  title={card?.source ?? reason}
                >
                  {last
                    ? (provider?.name ?? (card?.imported ? "가져온 전국 자료" : card?.source))
                    : reason}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px]">
                    {last ? `${card?.classification} · ${stateLabel}` : stateLabel}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {card?.classification === "MTI" ? "MTI 품목" : (proxy?.label ?? "코드 미확인")}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    매핑 {verified.length}/{mapped.length}
                  </Badge>
                </div>
                {it.subItems.length > 0 && (
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {it.subItems.join(" · ")}
                  </div>
                )}
              </button>
              <button
                type="button"
                disabled={!on && picked.length >= 6}
                className="mt-2 min-h-11 text-[11px] text-desk-gold hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => togglePick(it.key)}
              >
                {on
                  ? "오버레이에서 빼기"
                  : picked.length >= 6
                    ? "오버레이 6개 가득 참"
                    : "오버레이에 넣기"}
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
  const catalog = useTradeCategoryCatalog();
  const motie = useMotieRelease();
  const cards = useCategoryCards(observations, catalog.data, motie.data);
  const [q, setQ] = useState("");
  const [onlyMapped, setOnlyMapped] = useState(false);
  const exposures = useExportDeskStore((s) => s.exposures);
  const core = getCore20().items as { key: string; ko: string }[];
  const cats = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        value: number;
        period: string;
        classification: TradeObservation["classification"] | null;
      }
    >();
    for (const it of core) {
      map.set(it.key, { id: it.key, name: it.ko, value: 0, period: "", classification: null });
    }
    for (const card of cards.values()) {
      map.set(card.id, {
        id: card.id,
        name: core.find((it) => it.key === card.id)?.ko ?? card.label,
        value: card.current?.valueUsd ?? 0,
        period: card.current?.period ?? "",
        classification: card.classification,
      });
    }
    let rows = [...map.values()].filter((r) => r.period || core.some((c) => c.key === r.id));
    if (q.trim()) {
      const n = q.trim().toLowerCase();
      rows = rows.filter((r) => r.id.toLowerCase().includes(n) || r.name.toLowerCase().includes(n));
    }
    if (onlyMapped) {
      const ids = new Set(
        exposures.filter((e) => e.active !== false).map((e) => e.exportCategoryId),
      );
      rows = rows.filter((r) => ids.has(r.id));
    }
    return rows.sort((a, b) => b.value - a.value);
  }, [cards, q, onlyMapped, exposures, core]);

  const barRows = cats.filter((c) => c.id.startsWith("hs2:") && c.value > 0).slice(0, 15);
  const bar = barRows.map((c) => ({
    name: c.name.replace(/ \(HS.*$/, ""),
    value: c.value / 1e9,
    period: c.period,
    id: c.id,
  }));
  const barAsOf = barRows.reduce((m, c) => (c.period > m ? c.period : m), ""); // ked-allow-string-date-sort: single-format time series
  const barSources = [
    ...new Set(
      observations
        .filter((o) => barRows.some((c) => c.id === o.categoryId))
        .map((o) => o.sourceFile),
    ),
  ]
    .slice(0, 2)
    .join(", ");

  return (
    <section className="desk-card p-4">
      <div className="mb-3 flex flex-wrap gap-2">
        <Input
          aria-label="수출 품목명 또는 코드 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="품목명 · 코드"
          className="max-w-xs"
        />
        <label className="inline-flex items-center gap-1.5 text-xs">
          <Switch checked={onlyMapped} onCheckedChange={setOnlyMapped} />
          매핑 후보가 있는 품목만
        </label>
        <MotieReleaseBadge query={motie} />
      </div>
      <p role="status" className="mb-3 text-xs text-muted-foreground">
        {catalog.isLoading
          ? "전체 품목의 공식 저장 자료를 자동으로 불러오고 있습니다."
          : catalog.isError
            ? "품목 요약 조회에 실패했습니다. 확보한 관측은 유지합니다."
            : catalog.warmingPaused
              ? "일부 품목이 조회 대기 중입니다. 자료 새로고침으로 다시 진행할 수 있습니다."
              : catalog.data?.pending.length
                ? `공식 자료 자동 확인 중 · 남은 품목 ${catalog.data.pending.length}개`
                : "확인된 품목별 최신 기준월과 실제 분류를 표시합니다."}
      </p>
      {bar.length > 0 && (
        <div className="mb-4">
          <ChartFrame
            title="품목별 최신 수출 (HS 2단위 · 기준월은 개별 표시)"
            unit="USD bn"
            source={barSources || "수출 관측값"}
            asOf={barAsOf || null}
            ariaLabel={`수출 상위 ${bar.length}개 품목 막대 차트: ${bar
              .slice(0, 5)
              .map((b) => `${b.name} ${b.value.toFixed(1)}bn`)
              .join(", ")}`}
            pngName={chartExportName("KR", "EXPORT", "top-hs2", "png", Date.now())}
            csv={() => ({
              text: [
                "id,name,period,value_usd_bn",
                ...barRows.map(
                  (c) =>
                    `${c.id},"${c.name.replace(/"/g, "'")}",${c.period},${(c.value / 1e9).toFixed(3)}`,
                ),
              ].join("\n"),
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
                  <Tooltip
                    formatter={(v: number) => `$${Number(v).toFixed(1)}bn`}
                    labelFormatter={(_label, payload) =>
                      `${payload?.[0]?.payload?.name ?? ""} · ${payload?.[0]?.payload?.period ?? ""}`
                    }
                  />
                  <Bar
                    dataKey="value"
                    fill="#d4a017"
                    name="수출 $bn"
                    onClick={(d) => onOpen(String((d as { id?: string }).id))}
                  />
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
              <th>기준월</th>
              <th>분류·상태</th>
            </tr>
          </thead>
          <tbody>
            {cats.map((c) => (
              <tr key={c.id} className="hover:bg-muted/30">
                <td>
                  <button
                    type="button"
                    className="min-h-11 text-left hover:underline"
                    onClick={() => onOpen(c.id)}
                  >
                    {c.name}
                  </button>
                </td>
                <td className="tabular text-xs">{c.id}</td>
                <td className="text-right tabular" title={categoryCardReason(cards.get(c.id))}>
                  {c.period && Number.isFinite(c.value)
                    ? formatUsdBn(c.value)
                    : categoryCardState(cards.get(c.id), catalog.isLoading)}
                </td>
                <td className="whitespace-nowrap text-xs">{c.period || "—"}</td>
                <td>
                  <Badge variant="outline" className="text-[10px]">
                    {c.classification ?? "미확인"} ·{" "}
                    {categoryCardState(cards.get(c.id), catalog.isLoading)}
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

function IndustryPanel({ cat, onCat }: { cat: string; onCat: (c: string) => void }) {
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
  const now = useMarketClock();
  const capRanking = useMemo(
    () => observedCapRanking(caps.data?.quotes ?? [], settings.universeN, now),
    [caps.data, settings.universeN, now],
  );
  const asOf = capRanking.asOf;
  const universe = capRanking.members;
  const universeKey = universe.map((u) => `${u.ticker}:${u.rank}`).join(",");
  const tickers = useMemo(() => new Set(universe.map((u) => u.ticker)), [universeKey]);
  const verified = useMemo(
    () =>
      asOf
        ? resolveCompanySectorExposure(exposures.filter(isEvidenceBackedExposure), {
            categoryId: cat,
            asOf,
            top100Tickers: tickers,
            minWeight: settings.minWeight,
            minConfidence: settings.minConfidence,
            primaryOnly: settings.primaryOnly,
          })
        : [],
    [
      asOf,
      exposures,
      cat,
      tickers,
      settings.minWeight,
      settings.minConfidence,
      settings.primaryOnly,
    ],
  );
  const candidates = useMemo(
    () =>
      exposures
        .filter(
          (e) =>
            e.exportCategoryId === cat &&
            e.active !== false &&
            (!settings.primaryOnly || e.mappingType === "PRIMARY") &&
            (!asOf || tickers.has(e.ticker)),
        )
        .sort(
          (a, b) =>
            (universe.find((u) => u.ticker === a.ticker)?.rank ?? Infinity) -
            (universe.find((u) => u.ticker === b.ticker)?.rank ?? Infinity),
        ),
    [exposures, cat, settings.primaryOnly, asOf, tickers, universeKey],
  );
  const matched = verifiedOnly ? verified : candidates;
  const chartNames = useMemo(() => matched.slice(0, 6), [matched]);
  const verifiedNames = useMemo(() => chartNames.filter(isEvidenceBackedExposure), [chartNames]);
  const px = useIndustryMonthlyPrices(chartNames.map((m) => m.ticker));
  const exports = useExportSeries(cat);
  const quotes = new Map(capRanking.quotes.map((q) => [q.ticker, q]));
  const catLabel =
    items.find((i) => i.key === cat)?.ko ?? (cat.startsWith("hs2:") ? hsName(cat.slice(4)) : cat);
  const overlay = useMemo(() => {
    const expValues = exports.map((e) => e.valueUsd);
    const exportLevels =
      settings.levelSeries === "raw"
        ? expValues
        : settings.levelSeries === "wad"
          ? exports.map((e) => calculateWorkingDayAdjusted(e.valueUsd, e.workingDays ?? 0) ?? NaN)
          : calculateRolling12MSum(expValues);
    const exportByP = new Map(exports.map((e, i) => [e.period, exportLevels[i] ?? NaN]));
    const priceMaps = new Map(
      chartNames.map((m) => [
        m.ticker,
        new Map((px.data?.series[m.ticker] ?? []).map((p) => [p.date.slice(0, 7), p.value])),
      ]),
    );
    const periods = [
      ...new Set([
        ...exports.map((e) => e.period),
        ...[...priceMaps.values()].flatMap((m) => [...m.keys()]),
      ]),
    ].sort();
    const visiblePeriods = clipRange(
      periods.map((period) => ({ period })),
      settings.range,
    ).map((r) => r.period);
    const common = visiblePeriods.find(
      (p) =>
        Number.isFinite(exportByP.get(p)) &&
        verifiedNames.length > 0 &&
        verifiedNames.every((m) => (priceMaps.get(m.ticker)?.get(p) ?? 0) > 0),
    );
    const exportBasePeriod = common ?? visiblePeriods.find((p) => (exportByP.get(p) ?? 0) > 0);
    const expBase = exportBasePeriod ? exportByP.get(exportBasePeriod) : undefined;
    const priceBases = new Map(
      chartNames.map((m) => {
        const map = priceMaps.get(m.ticker)!;
        const p = common ?? visiblePeriods.find((p) => (map.get(p) ?? 0) > 0);
        return [m.ticker, p ? map.get(p) : undefined];
      }),
    );
    const weightSum = verifiedNames.reduce((sum, m) => sum + m.exposureWeight, 0);
    return periods.map((period) => {
      const names: Record<string, number | null> = {};
      for (const m of chartNames) {
        const price = priceMaps.get(m.ticker)?.get(period);
        const base = priceBases.get(m.ticker);
        names[m.ticker] = price != null && base ? numOrNull((price / base) * 100) : null;
      }
      const allMembersPresent =
        common && verifiedNames.length > 0 && verifiedNames.every((m) => names[m.ticker] != null);
      const compIdx =
        allMembersPresent && weightSum > 0
          ? verifiedNames.reduce((sum, m) => sum + names[m.ticker]! * m.exposureWeight, 0) /
            weightSum
          : null;
      const exp = exportByP.get(period);
      return {
        period,
        expIdx: exp != null && expBase ? numOrNull((exp / expBase) * 100) : null,
        compIdx,
        names,
      };
    });
  }, [exports, px.data, chartNames, verifiedNames, settings.range, settings.levelSeries]);
  const clipped = clipRange(overlay, settings.range);
  const inf = pearsonWithInference(
    calculateYoYGrowth(clipped.map((r) => r.expIdx ?? NaN)),
    calculateYoYGrowth(clipped.map((r) => r.compIdx ?? NaN)),
    { transform: "yoy" },
  );
  const individual = chartNames
    .map((m) => ({
      id: m.ticker,
      name: m.companyName,
      points: clipped
        .filter((r) => r.names[m.ticker] != null)
        .map((r) => ({ time: r.period, value: r.names[m.ticker]! })),
    }))
    .filter((s) => s.points.length > 0);
  const source =
    [...new Set(exports.filter((e) => Number.isFinite(e.valueUsd)).map((e) => e.sourceFile))].join(
      " · ",
    ) || "수출 관측 미확보";
  const hasOverlay = clipped.some((r) => r.expIdx != null || r.compIdx != null);
  return (
    <section className="desk-card desk-card-indigo p-4 space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <select
          aria-label="비교할 수출 품목"
          className="min-h-11 max-w-full rounded-md border border-border bg-background px-2 text-sm"
          value={cat}
          onChange={(e) => onCat(e.target.value)}
        >
          {items.map((it) => (
            <option key={it.key} value={it.key}>
              {it.ko}
            </option>
          ))}
          {extraCats.sort().map((id) => (
            <option key={id} value={id}>
              {id.startsWith("hs2:") ? hsName(id.slice(4)) : id}
            </option>
          ))}
        </select>
        <label className="inline-flex min-h-11 items-center gap-1.5 text-xs">
          <Switch
            checked={settings.primaryOnly}
            onCheckedChange={(v) => useExportDeskStore.getState().patchSettings({ primaryOnly: v })}
          />
          주력 사업 후보만
        </label>
        <label className="inline-flex min-h-11 items-center gap-1.5 text-xs">
          <Switch checked={verifiedOnly} onCheckedChange={setVerifiedOnly} />
          검증된 매핑만
        </label>
        <label className="inline-flex min-h-11 items-center gap-1.5 text-xs">
          <Switch checked={showNames} onCheckedChange={setShowNames} />
          개별 종목선
        </label>
        <span className="text-[11px] text-muted-foreground">
          Top {settings.universeN} · 후보 {candidates.length} · 검증 {verified.length}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        <strong>{catLabel}</strong> 수출과 관련 사업 후보의 실제 월별 주가를 비교합니다. 후보 목록은
        수출 매출 비중이 검증된 자료가 아닙니다. 시총 자료: {caps.data?.source ?? "확인 중"} · 기준{" "}
        {asOf ?? "미확인 (후보 목록만 표시)"} · 유효 시총 {capRanking.verifiedCount}/
        {capRanking.totalCount}종목. 현재 관측 범위의 순위이며 과거 편입 순위를 재현하지 않습니다.
      </p>
      {caps.isError && (
        <p role="status" className="text-xs text-desk-copper">
          시총 자료를 가져오지 못했습니다. 후보는 표시하지만 Top 순위는 확정하지 않습니다.
        </p>
      )}
      {verifiedNames.length === 0 && (
        <p className="text-xs text-muted-foreground">
          근거가 확인된 노출 가중치가 없어 기업 합성지수와 수출-주가 상관은 표시하지 않습니다.
          미검증 후보는 실제 개별 주가만 비교하며 임시 노출 비중을 계산에 사용하지 않습니다.
        </p>
      )}
      {hasOverlay ? (
        <ExportDualChart
          sharedScale
          data={clipped.map((r) => ({ time: r.period, a: r.expIdx, b: r.compIdx }))}
          history={overlay.map((r) => ({ time: r.period, a: r.expIdx, b: r.compIdx }))}
          aName={`${catLabel} 수출=100`}
          bName={`검증 ${verifiedNames.length}개 고정 표본=100`}
          source={`${source} · ${px.data?.source ?? "월별 시세 확인 중"}`}
          asOf={px.data?.fetchedAt ?? null}
          mode="월간 · 공통 기준월=100 · 결측월은 비움"
        />
      ) : (
        <EmptyExport />
      )}
      {showNames &&
        (px.isFetching && !individual.length ? (
          <p role="status" className="py-4 text-sm text-muted-foreground">
            후보 기업의 실제 월별 시세를 확인하고 있습니다.
          </p>
        ) : individual.length > 0 ? (
          <ExportAmountChart
            series={individual}
            focusId={individual[0]!.id}
            source={px.data?.source ?? "월별 시세"}
            asOf={px.data?.fetchedAt ?? null}
            title={`${catLabel} 관련 사업 후보 · 개별 주가`}
            formatValue={(v) => v.toFixed(1)}
            mode="완료 월 주가 · 종목별 기준=100"
            note="미검증 후보의 수출 비중은 반영하지 않습니다. 공통 기준월이 없으면 종목별 첫 관측을 100으로 표시합니다."
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            {px.isError
              ? "기업 월별 시세 요청에 실패했습니다. 자료 새로고침으로 다시 확인하세요."
              : "표시할 개별 월별 시세가 없습니다."}
          </p>
        ))}
      {showNames &&
        !individual.length &&
        !px.isFetching &&
        px.data?.providers?.map((p) => (
          <p key={p.id} className="text-[11px] text-muted-foreground">
            {p.name} · {PROVIDER_LABELS[p.state]} · {p.message}
          </p>
        ))}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Kpi
          label="수출-검증 표본 YoY 상관"
          value={
            inf.insufficient
              ? t("export.insufficient", lang)
              : inf.r == null
                ? "N/A"
                : inf.r.toFixed(3)
          }
          sub={`N=${inf.n} · 검증 가중치만 사용`}
        />
        <Kpi
          label="매핑 후보 / 검증"
          value={`${candidates.length} / ${verified.length}`}
          sub={`개별 시세 최대 ${chartNames.length}개`}
        />
        <Kpi
          label="확인된 시총 범위"
          value={String(universe.length)}
          sub={caps.data?.source ?? "시총 관측 미확보"}
        />
      </div>
      {matched.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm">
          {verifiedOnly
            ? "검증된 매핑이 없습니다. ‘검증된 매핑만’을 끄면 관련 사업 후보와 실제 시세를 확인할 수 있습니다."
            : t("export.empty.sector", lang)}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="desk-table w-full min-w-[560px]">
            <caption className="sr-only">관련 기업 후보와 검증 상태</caption>
            <thead>
              <tr>
                <th>종목</th>
                <th>역할</th>
                <th className="text-right">검증 노출</th>
                <th className="text-right">관측 순위</th>
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
                      <Link
                        to="/stock/$ticker"
                        params={{ ticker: m.ticker }}
                        className="inline-flex min-h-11 items-center hover:underline"
                      >
                        {m.companyName}
                      </Link>
                      <div className="text-[10px] text-muted-foreground">{m.ticker}</div>
                    </td>
                    <td className="text-xs">{m.valueChainRole}</td>
                    <td className="text-right tabular">
                      {isEvidenceBackedExposure(m)
                        ? `${(m.exposureWeight * 100).toFixed(0)}%`
                        : "미확인"}
                    </td>
                    <td className="text-right tabular">{rank ?? "N/A"}</td>
                    <td
                      className={cn(
                        "text-right tabular",
                        q && (q.changePct >= 0 ? "text-price-up" : "text-price-down"),
                      )}
                    >
                      {q ? `${q.changePct.toFixed(2)}%` : "N/A"}
                    </td>
                    <td>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          !isEvidenceBackedExposure(m) && "text-desk-copper",
                        )}
                      >
                        {isEvidenceBackedExposure(m) ? "근거 확인" : "사업 후보 · 노출 미검증"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Provenance
        source={`${source} · ${px.data?.source ?? "월별 시세 대기"}`}
        period={`${clipped[0]?.period ?? "—"} ~ ${clipped.at(-1)?.period ?? "—"}`}
        ingested={px.data?.fetchedAt ?? caps.data?.fetchedAt ?? "—"}
        taxonomy={`${getCore20().taxonomyVersion} (미검증 참고 분류)`}
      />
    </section>
  );
}

function CorrPanel() {
  const lang = useExportDeskStore((s) => s.lang);
  const settings = useExportDeskStore((s) => s.settings);
  const exports = useExportSeries("TOTAL");
  const macro = useDeskMacro();
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
    const partialN = e.filter(
      (value, i) => Number.isFinite(value) && Number.isFinite(k[i]) && Number.isFinite(f[i]),
    ).length;
    const partial = partialN >= 24 ? calculatePartialCorrelation(e, k, f) : null;
    const xcorr = calculateCrossCorrelation(e, k, 6);
    return { inf, raw, partial, partialN, xcorr, n: e.filter(Number.isFinite).length };
  }, [exports, kospi, fx, settings.range]);

  return (
    <section className="desk-card p-4 space-y-3">
      <h2 className="text-lg font-semibold">{t("export.corr.title", lang)}</h2>
      <p className="text-xs text-muted-foreground">
        수출 관측월과 완료된 시장 관측월을 맞춘 사후 기술 통계입니다. 공표 시각을 재현하는
        백테스트가 아니며, 미래 예측이나 매수·매도 의견으로 사용하지 않습니다.
      </p>
      {pack.inf.insufficient ? (
        <div className="rounded-md border px-3 py-6 text-center text-sm">
          {t("export.insufficient", lang)} (N={pack.inf.n})
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Kpi
            label="Pearson YoY · HAC(11)"
            value={pack.inf.r == null ? "N/A" : pack.inf.r.toFixed(3)}
            sub={`N=${pack.inf.n} SE=${pack.inf.se?.toFixed(3) ?? "N/A"}`}
          />
          <Kpi
            label="USD/KRW 통제 편상관"
            value={pack.partial == null ? "N/A" : pack.partial.toFixed(3)}
            sub={`공통 수출·주가·환율 N=${pack.partialN} (최소 24개월)`}
          />
          <Kpi
            label="탐색적 최대 상관 시차"
            value={
              pack.xcorr
                .filter((x) => x.corr != null)
                .sort((a, b) => Math.abs(b.corr!) - Math.abs(a.corr!))[0]
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
  const levels = regionalCap.levels as {
    id: string;
    ko: string;
    available?: boolean;
    reason?: string;
    note?: string;
  }[];
  return (
    <section className="desk-card p-4 space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Globe2 className="size-4" /> 수출 목적지 · 지역
      </h2>
      <p className="text-xs text-muted-foreground">
        국가별 자료의 제공처: {dest?.source ?? "연결 확인 중"}. 시도/시군구는 공식 미제공 시 숫자를
        만들지 않습니다.
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
                <td className="text-right tabular">
                  {r.share != null && Number.isFinite(r.share)
                    ? `${(r.share * 100).toFixed(1)}%`
                    : "N/A"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="text-sm text-muted-foreground">
          {live.isLoading
            ? "상대국 집계 수집 중"
            : "상대국 관측을 확보하지 못했습니다. 데이터 품질 / 출처에서 국가별 서비스의 인증·요청 제한 사유를 확인하고 자료 새로고침으로 다시 조회할 수 있습니다."}
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
        <select
          value={geo}
          onChange={(e) => setGeo(e.target.value)}
          className="h-8 rounded border bg-background px-2"
        >
          <option>NATIONAL</option>
          <option>SIDO</option>
          <option>SIGUNGU</option>
        </select>
        <select
          value={cls}
          onChange={(e) => setCls(e.target.value)}
          className="h-8 rounded border bg-background px-2"
        >
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
        <div className="text-xs text-muted-foreground">
          선택한 큐브는 가져오기 후에만 값이 있습니다.
        </div>
      )}
    </div>
  );
}

function QaPanel() {
  const observations = useAllObservations();
  const logs = useExportDeskStore((s) => s.logs);
  const live = useLiveTrade();
  const motie = useMotieRelease();
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
        <li>
          · 총수출·총수입: {live.data?.source.totals ?? "서버 연결 확인 중"}. 선택한 제공처의
          단위·공표 기준을 적용합니다.
        </li>
        <li>
          · 품목: {live.data?.source.items ?? "서버 연결 확인 중"}. HS와 MTI는 구분하며 HS 85 전체를
          반도체로 쓰지 않습니다.
        </li>
        <li>
          · 관세청 연결·인증 여부와 오류 사유는 아래 실제 서버 상태를 따릅니다. 산업부 속보:{" "}
          {motie.data?.provider.message ?? "공식 원문과 수치를 확인하고 있습니다."}
        </li>
        <li>
          · 화면의 참고 품목 목록은 공식 분류 개정 목록이 아닙니다. 개별 금액은 실제 원문의 MTI·HS
          분류, 기준월과 검증 상태를 따릅니다.
        </li>
        {(live.data?.notes ?? []).map((n) => (
          <li key={n}>· {n}</li>
        ))}
        <li>
          · 총수출 관측 {totals.length}개월 · HS2 품목월 {parts.length}행 · Comtrade 캐시{" "}
          {live.data?.comtradeMonthsCached ?? 0}개월
        </li>
      </ul>
      <div className="text-xs">
        <MotieReleaseBadge query={motie} />
      </div>
      <SourceHealth />
      <div className="text-sm">
        HS2 합과 선택 총수출의 참고 대조 {recon ? (recon.pass ? "허용 범위" : "차이 있음") : "N/A"}
        {recon && ` · gap ${recon.gapPct.toFixed(2)}%`}
        <span className="block text-[11px] text-muted-foreground">
          제공처·정의·대상 월이 다를 수 있어 이 대조를 데이터 정확성의 PASS 판정으로 사용하지
          않습니다.
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        합성·데모 데이터는 제공하지 않습니다. 공식 관측값이 없으면 N/A로 표시합니다.
      </p>
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
  const statuses = useProviderStatuses();
  const live = useLiveTrade();
  const macro = useDeskMacro();
  const actual = new Map(statuses.map((p) => [p.id, p]));
  const rows = [
    ...DATA_SOURCES.map((s) => ({
      id: s.id,
      name: s.displayName,
      operator: s.operator,
      url: s.portal,
    })),
    ...statuses
      .filter((p) => !DATA_SOURCES.some((s) => s.id === p.id))
      .map((p) => ({ id: p.id, name: p.name, operator: "공식 통계·시장 자료", url: p.sourceUrl })),
  ];
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="desk-table w-full min-w-[620px] text-xs">
          <caption className="sr-only">실제 서버 요청에 따른 자료 제공처 연결 상태</caption>
          <thead>
            <tr>
              <th scope="col">소스</th>
              <th scope="col">운영</th>
              <th scope="col">연결 상태 / 사유</th>
              <th scope="col">관측 기준 · 행 수</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const p = actual.get(row.id);
              return (
                <tr key={row.id}>
                  <td>
                    <a
                      href={p?.sourceUrl || row.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center hover:underline"
                    >
                      {p?.name || row.name}
                      <span className="sr-only"> (새 탭)</span>
                    </a>
                  </td>
                  <td>{row.operator}</td>
                  <td>
                    <div>
                      {p
                        ? PROVIDER_LABELS[p.state]
                        : live.isFetching || macro.isFetching
                          ? "확인 중"
                          : row.id === "customs.item"
                            ? "품목 선택 시 확인"
                            : "분석 연결 미구현"}
                    </div>
                    <div className="max-w-sm whitespace-normal text-[11px] text-muted-foreground">
                      {p?.message ||
                        (row.id === "customs.item"
                          ? "품목을 선택하면 해당 서비스의 인증·응답 상태를 확인합니다."
                          : "이 제공처의 데이터는 현재 분석에 연결되어 있지 않습니다.")}
                    </div>
                    {p?.checkedAt && (
                      <div className="text-[10px] text-muted-foreground">
                        확인 {formatMarketAsOf(p.checkedAt)}
                      </div>
                    )}
                  </td>
                  <td>
                    {p ? `${p.asOf || "관측 없음"} · ${p.recordCount.toLocaleString()}행` : "—"}
                    {p?.provisional && <div className="text-desk-copper">잠정치</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        API 인증키는 서버 환경 변수로만 관리합니다. 이전 버전의 브라우저 키 입력은 서버 요청에
        연결되지 않았으며 해당 저장 항목은 제거했습니다. 위 상태는 실제 요청 결과입니다.
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
    exposureWeight: "",
    mappingConfidence: "",
    evidenceUrl: "",
  });

  function save() {
    if (
      !/^https?:\/\/\S+$/i.test(form.evidenceUrl.trim()) ||
      !form.exposureWeight.trim() ||
      !form.mappingConfidence.trim() ||
      !Number.isFinite(Number(form.mappingConfidence)) ||
      Number(form.mappingConfidence) < 0 ||
      Number(form.mappingConfidence) > 1
    ) {
      setErr("근거 자료 URL과 노출 가중치·신뢰도(0~1)를 입력해 주세요.");
      return;
    }
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
      evidenceSource: [form.evidenceUrl.trim()],
      effectiveFrom: kstYmd(),
      lastReviewedAt: kstYmd(),
      active: true,
    };
    const r = upsert(row);
    setErr(r.ok ? null : (r.error ?? "저장 실패"));
  }

  return (
    <section className="desk-card p-4 space-y-3">
      <h2 className="text-lg font-semibold">매핑 관리</h2>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          placeholder="코드"
          value={form.ticker}
          onChange={(e) => setForm({ ...form, ticker: e.target.value })}
        />
        <Input
          placeholder="이름"
          value={form.companyName}
          onChange={(e) => setForm({ ...form, companyName: e.target.value })}
        />
        <Input
          placeholder="산업 key"
          value={form.exportCategoryId}
          onChange={(e) => setForm({ ...form, exportCategoryId: e.target.value })}
        />
        <Input
          placeholder="노출 가중치 (0~1)"
          aria-label="노출 가중치"
          value={form.exposureWeight}
          onChange={(e) => setForm({ ...form, exposureWeight: e.target.value })}
        />
        <Input
          placeholder="신뢰도 (0~1)"
          aria-label="매핑 신뢰도"
          value={form.mappingConfidence}
          onChange={(e) => setForm({ ...form, mappingConfidence: e.target.value })}
        />
        <Input
          placeholder="근거 자료 URL"
          aria-label="노출 가중치 근거 자료 URL"
          value={form.evidenceUrl}
          onChange={(e) => setForm({ ...form, evidenceUrl: e.target.value })}
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
              <tr
                key={`${e.ticker}-${e.exportCategoryId}`}
                className={e.active === false ? "opacity-50" : ""}
              >
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
                  <button
                    type="button"
                    className="text-desk-rose"
                    onClick={() => remove(e.ticker, e.exportCategoryId)}
                  >
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
  const upsertIndex = useExportDeskStore((s) => s.upsertIndex);
  const upsertFx = useExportDeskStore((s) => s.upsertFx);
  const dump = useExportDeskStore((s) => s.exportStoreJson);
  const load = useExportDeskStore((s) => s.importStoreJson);
  const reset = useExportDeskStore((s) => s.resetStore);
  const [msg, setMsg] = useState<string | null>(null);
  const [importer, setImporter] = useState<ImporterId>("MTI_MONTHLY_EXPORT");

  async function onFile(f: File) {
    const text = await f.text();
    if (importer === "KOSPI_INDEX_DAILY" || importer === "FX_USDKRW_DAILY") {
      const res = importIndexCsv(text, f.name);
      if (!res.ok) {
        setMsg(res.issues.map((i) => `${i.row}: ${i.message}`).join(" · "));
        return;
      }
      const log = {
        id: `${Date.now()}`,
        filename: f.name,
        importer,
        rowCount: res.rows.length,
        importedAt: new Date().toISOString(),
        ok: true,
      };
      (importer === "KOSPI_INDEX_DAILY" ? upsertIndex : upsertFx)(res.rows, log);
      setMsg(`${res.rows.length}행 반영. 완료된 월만 분석에 사용합니다. 경고 ${res.issues.length}`);
      return;
    }
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
        KITA/관세청/KRX에서 받은 CSV. 헤더는 한글·영문 모두 인식합니다. 단위: 천달러·백만불·억달러.
      </p>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="가져올 CSV 자료 종류"
          value={importer}
          onChange={(e) => setImporter(e.target.value as ImporterId)}
          className="min-h-11 max-w-full rounded-md border bg-background px-2 text-sm"
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
            setMsg(r.ok ? "스토어 복원" : (r.error ?? "실패"));
          }}
        />
      </div>
    </section>
  );
}
