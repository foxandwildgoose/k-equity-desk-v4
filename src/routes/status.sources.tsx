import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { getSourceHealth, retrySource, type SourceStatusRow } from "@/lib/feed-fns";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageDisclaimer } from "@/components/feed/PageDisclaimer";
import { TimeStamp } from "@/components/feed/TimeStamp";
import { Switch } from "@/components/ui/switch";
import { useAppStore, BLOOMBERG_SOURCE_IDS } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/status/sources")({
  component: SourceStatusPage,
  head: () => ({ meta: [{ title: "소스 상태 · Korea Equity Command Center" }] }),
});

const GROUP_LABEL: Record<string, string> = {
  "kr-news": "한국 뉴스",
  "us-news": "미국 뉴스",
  "kr-research": "한국 리서치",
  "us-research": "미국 리서치",
  etf: "ETF",
  robotics: "로봇",
  policy: "정책",
  "market-data": "시세·기초 데이터",
  disclosure: "공시",
};

const REGISTRY_LABEL: Record<string, string> = {
  verified: "검증됨",
  unverified: "미검증",
  candidate: "후보(검증 전)",
  disabled: "폐지·비활성",
};

type Chip = { label: string; tone: "ok" | "warn" | "bad" | "muted" };

function statusChip(r: SourceStatusRow, userOff: boolean): Chip {
  if (userOff) return { label: "사용자 끔", tone: "muted" };
  if (!r.runnable) return { label: r.runnableReason ?? "비활성", tone: "muted" };
  if (r.health.circuit === "open") return { label: "차단(circuit)", tone: "bad" };
  if (r.health.lastSuccessAt && r.health.consecutiveFailures === 0) {
    return r.health.itemCount === 0 ? { label: "정상 · 0건", tone: "warn" } : { label: "정상", tone: "ok" };
  }
  if (r.health.consecutiveFailures > 0) return { label: `실패 ${r.health.consecutiveFailures}회`, tone: "bad" };
  if (!r.hasAdapter) return { label: "기존 모듈 경로", tone: "muted" };
  return { label: "미시도", tone: "muted" };
}

function SourceStatusPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["source-health"], queryFn: () => getSourceHealth(), refetchInterval: 30_000, staleTime: 10_000 });
  const disabled = useAppStore((s) => s.newsPrefs.disabledSources);
  const bloombergEnabled = useAppStore((s) => s.newsPrefs.bloombergEnabled);
  const toggleSource = useAppStore((s) => s.toggleSource);
  const setNewsPrefs = useAppStore((s) => s.setNewsPrefs);
  const [pending, setPending] = useState<string | null>(null);
  const retry = useMutation({
    mutationFn: (id: string) => retrySource({ data: { id } }),
    onMutate: (id) => setPending(id),
    onSettled: () => {
      setPending(null);
      void qc.invalidateQueries({ queryKey: ["source-health"] });
    },
  });

  const rows = q.data?.rows ?? [];
  const groups = useMemo(() => {
    const map = new Map<string, SourceStatusRow[]>();
    for (const r of rows) {
      if (!map.has(r.group)) map.set(r.group, []);
      map.get(r.group)!.push(r);
    }
    return [...map.entries()];
  }, [rows]);
  const allUnverified = rows.length > 0 && rows.every((r) => r.registryStatus !== "verified");
  const userOff = new Set(disabled);
  if (!bloombergEnabled) for (const id of BLOOMBERG_SOURCE_IDS) userOff.add(id);

  return (
    <div className="page-stack">
      <PageHeader
        kicker="Source health · 소스 상태"
        title="소스 상태"
        lead="뉴스·리서치·공시·시세 소스별 최근 시도, 성공, HTTP 상태, 지연, 건수, 최신 게시 시각, 연속 실패와 차단(circuit) 상태입니다. 서버 인스턴스별 기록이며 배포 환경에서는 인스턴스마다 다를 수 있습니다."
        aside={
          <span className="text-[11px] text-muted-foreground">
            {q.data ? (
              <>
                갱신 <TimeStamp publishedAt={q.data.generatedAt} precision="second" />
              </>
            ) : (
              "불러오는 중…"
            )}
          </span>
        }
      />
      <PageDisclaimer />

      {allUnverified && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-relaxed" data-testid="unverified-banner">
          <strong>소스 미검증</strong> — 이 빌드는 외부 네트워크가 차단된 환경에서 만들어져 레지스트리의 모든 소스가 아직 실제
          응답으로 검증되지 않았습니다. 일반 인터넷이 되는 환경에서 <code>npm run verify:sources</code>를 실행하면
          <code> docs/upgrade/SOURCES_STATUS.md</code>가 갱신됩니다. 응답이 없는 패널은 비어 있는 대신 이유를 표시합니다.
        </div>
      )}

      {q.data && (
        <div className="flex flex-wrap gap-2 text-[11px]">
          <EnvChip ok={Boolean(q.data.env.secUserAgent)} label={q.data.env.secUserAgent ? "SEC UA 설정됨" : "SEC UA 미설정"} />
          <EnvChip ok={Boolean(q.data.env.kis)} label={q.data.env.kis ? "KIS 키 설정됨" : "KIS 키 없음 (네이버 스냅샷)"} />
          <EnvChip ok={Boolean(q.data.env.finnhub)} label={q.data.env.finnhub ? "Finnhub 키 설정됨" : "Finnhub 없음"} />
          <EnvChip ok={Boolean(q.data.env.bloomberg)} label={q.data.env.bloomberg ? "Bloomberg 서버 스위치 켜짐" : "NEWS_BLOOMBERG_ENABLED=false"} />
          <label className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-2">
            <Switch checked={bloombergEnabled} onCheckedChange={(v) => setNewsPrefs({ bloombergEnabled: v })} aria-label="Bloomberg 표시" />
            Bloomberg 표시 (앱 내 토글)
          </label>
        </div>
      )}

      {q.isError && <p className="text-sm text-price-down">상태를 불러오지 못했습니다.</p>}

      <div className="space-y-5">
        {groups.map(([group, list]) => (
          <section key={group} className="rounded-xl border border-border bg-card">
            <h2 className="border-b border-border px-3 py-2 text-sm font-semibold">{GROUP_LABEL[group] ?? group}</h2>
            <ul className="divide-y divide-border">
              {list.map((r) => {
                const off = userOff.has(r.id);
                const chip = statusChip(r, off);
                return (
                  <li key={r.id} className="grid gap-2 px-3 py-2.5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_auto]" data-source-row={r.id}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[13px] font-semibold">{r.name}</span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                            chip.tone === "ok" && "bg-emerald-500/15 text-emerald-500",
                            chip.tone === "warn" && "bg-amber-500/15 text-amber-500",
                            chip.tone === "bad" && "bg-price-up/15 text-price-up",
                            chip.tone === "muted" && "bg-muted text-muted-foreground",
                          )}
                        >
                          {chip.label}
                        </span>
                        <span className="rounded border border-border px-1 text-[10px] text-muted-foreground">
                          {REGISTRY_LABEL[r.registryStatus] ?? r.registryStatus}
                        </span>
                        {r.paywalled && <span className="text-[10px] font-semibold text-desk-gold">유료</span>}
                      </div>
                      <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground" title={r.url ?? ""}>
                        {r.id} · {r.format.toUpperCase()} · T{r.tier}
                      </div>
                      {Object.values(r.health.notes).map((n) => (
                        <div key={n} className="mt-0.5 text-[10px] font-medium text-amber-500">
                          {n}
                        </div>
                      ))}
                    </div>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10.5px] sm:grid-cols-4">
                      <Stat k="최근 시도" v={r.health.lastAttemptAt ? <TimeStamp publishedAt={r.health.lastAttemptAt} precision="second" /> : "—"} />
                      <Stat k="최근 성공" v={r.health.lastSuccessAt ? <TimeStamp publishedAt={r.health.lastSuccessAt} precision="second" /> : "—"} />
                      <Stat k="HTTP · 지연" v={`${r.health.httpStatus ?? "—"} · ${r.health.latencyMs != null ? `${r.health.latencyMs}ms` : "—"}`} />
                      <Stat k="건수 · 경로" v={`${r.health.itemCount ?? "—"} · ${r.health.adapterPath ?? "—"}`} />
                      <Stat
                        k="최신 게시"
                        v={r.health.newestPublishedAt ? <TimeStamp publishedAt={r.health.newestPublishedAt} precision="minute" /> : "—"}
                      />
                      <Stat k="차단 해제" v={r.health.circuitUntil ? <TimeStamp publishedAt={r.health.circuitUntil} precision="second" /> : "—"} />
                      <div className="col-span-2 min-w-0 truncate text-price-down/90" title={r.health.lastError ?? ""}>
                        {r.health.lastError ?? ""}
                      </div>
                    </dl>
                    <div className="flex items-center gap-2 md:justify-end">
                      <label className="inline-flex min-h-9 items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Switch
                          checked={!off}
                          onCheckedChange={(v) => {
                            if (BLOOMBERG_SOURCE_IDS.includes(r.id) && v && !bloombergEnabled) setNewsPrefs({ bloombergEnabled: true });
                            toggleSource(r.id, v);
                          }}
                          aria-label={`${r.name} 표시`}
                        />
                        표시
                      </label>
                      <button
                        type="button"
                        disabled={!r.runnable || !r.hasAdapter || pending === r.id || r.health.circuit === "open"}
                        onClick={() => retry.mutate(r.id)}
                        className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2 text-[11px] font-semibold hover:bg-muted/50 disabled:opacity-40"
                        title={r.health.circuit === "open" ? "차단 중에는 재시도하지 않습니다" : "캐시를 한 번 건너뛰고 다시 요청"}
                      >
                        {pending === r.id ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                        지금 재시도
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[9.5px] text-muted-foreground">{k}</dt>
      <dd className="truncate tabular">{v}</dd>
    </div>
  );
}

function EnvChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn("inline-flex min-h-9 items-center rounded-md border px-2 font-medium", ok ? "border-emerald-500/40 text-emerald-500" : "border-amber-500/40 text-amber-500")}>
      {label}
    </span>
  );
}
