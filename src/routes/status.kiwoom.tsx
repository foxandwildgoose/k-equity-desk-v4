import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getKiwoomDiagnostics } from "@/lib/kiwoom-diagnostic-fns";
import { KIWOOM_HEALTH_LABELS, KIWOOM_NEXT_STEPS } from "@/lib/charts/hts-flow";

const DIAGNOSTIC_STATUS_LABELS = {
  ...KIWOOM_HEALTH_LABELS,
  PUBLIC_READ_CONFIGURED: "공개 시장자료 읽기 설정됨",
};
const DIAGNOSTIC_NEXT_STEPS = {
  ...KIWOOM_NEXT_STEPS,
  PUBLIC_READ_CONFIGURED: "차트는 로그인 없이 저장된 키움 시장자료를 읽을 수 있습니다. 이 진단에서는 DB 연결·저장 이력을 점검하지 않았습니다.",
};

function collectorTime(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return "없음";
  return `${new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "medium" }).format(new Date(value))} KST`;
}

export const Route = createFileRoute("/status/kiwoom")({ component: KiwoomStatus });
function KiwoomStatus() {
  const { user } = useCurrentUserState();
  const to = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
  const query = useQuery({
    queryKey: ["kiwoom-diagnostics", user?.isDevFallback ? null : user?.id, to],
    queryFn: () =>
      getKiwoomDiagnostics({
        data: { code: "005930", from: `${Number(to.slice(0, 4)) - 1}-01-01`, to },
      }),
    retry: false,
    staleTime: 30000,
  });
  const data = query.data;
  return (
    <div className="page-stack">
      <PageHeader
        kicker="Kiwoom · Read-only diagnostics"
        title="키움 연결 상태"
        lead="공개 시장자료 읽기 설정과 소유자 전용 운영 진단을 구분합니다. 저장 이력 점검은 소유자만 가능하며, 토큰 발급·수집·DB 마이그레이션은 실행하지 않습니다."
        aside={user && !user.isDevFallback ? <UserButton /> : undefined}
      />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void query.refetch()} disabled={query.isFetching}>
          상태 새로고침
        </Button>
        <Button asChild variant="outline">
          <Link to="/login">소유자 로그인</Link>
        </Button>
      </div>
      {query.isError && <p role="alert">상태 조회 실패 · 서버 설정을 확인하세요.</p>}
      {data && (
        <>
          <p data-testid="kiwoom-health" className="text-sm font-semibold">
            {DIAGNOSTIC_STATUS_LABELS[data.status]} · {data.mode} · {data.environment}
          </p>
          <p className="text-sm" data-testid="kiwoom-next-step">
            {DIAGNOSTIC_NEXT_STEPS[data.status]}
          </p>
          <dl className="grid gap-3 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-2">
            <div data-testid="kiwoom-market-read-access">
              <dt className="text-muted-foreground">시장자료 읽기 권한</dt>
              <dd className="font-semibold">
                {data.marketReadAccess === "PUBLIC_READ_ALLOWED" ? "공개 읽기 허용 · 로그인 불필요"
                  : data.marketReadAccess === "OWNER_READ_ALLOWED" ? "소유자 읽기 허용" : "소유자 로그인 필요"}
              </dd>
            </div>
            <div data-testid="kiwoom-operator-access">
              <dt className="text-muted-foreground">상세 운영 진단 권한</dt>
              <dd className="font-semibold">
                {data.operationalDetailsAccess === "OWNER_ALLOWED" ? "소유자 확인됨" : "소유자 로그인 필요"}
              </dd>
            </div>
          </dl>
          <p className="text-sm text-muted-foreground" data-testid="kiwoom-revision">
            실행 버전 {data.deploymentRevision ?? "미확인"} · {data.deploymentStatus}
          </p>
          <ul className="space-y-1 text-sm">
            {data.issues.map((issue) => (
              <li key={issue}>
                {KIWOOM_HEALTH_LABELS[issue]} ({issue}) · {KIWOOM_NEXT_STEPS[issue]}
              </li>
            ))}
          </ul>
          <dl className="grid gap-2 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-2">
            {Object.entries({
              "수집 기능": data.flowEnabled,
              "App Key 설정": data.appKeyConfigured,
              "App Secret 설정": data.appSecretConfigured,
              "웹앱 키 필요": data.credentialsRequired,
              "DB 설정": data.databaseConfigured,
              "허용 IP 설정": data.expectedEgressIpConfigured,
              "소유자 설정": data.ownerConfigured,
              "인증 활성": data.authenticationEnabled,
              "인증 서버 준비": data.authenticationReady,
              "소유자 세션 확인": data.ownerAuthorized,
              "시장자료 범위 설정": data.dataScopeConfigured,
              "자료 읽기 로그인 필요": data.ownerAuthorizationRequired,
            }).map(([label, configured]) => (
              <div key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{configured ? "예" : "아니오"}</dd>
              </div>
            ))}
            <div>
              <dt>DB 연결 확인</dt>
              <dd data-testid="kiwoom-database-inspection">
                {!data.ownerAuthorized || !data.databaseConfigured ? "미점검" : data.databaseConnected ? "연결됨" : "연결 실패"}
              </dd>
            </div>
            <div>
              <dt>DB 스키마 확인</dt>
              <dd>{data.schema ? data.schemaReady ? "준비됨" : "마이그레이션 필요" : "미점검"}</dd>
            </div>
            <div>
              <dt>출발 IP 확인</dt>
              <dd>{data.egressStatus}</dd>
            </div>
            <div>
              <dt>토큰 확인</dt>
              <dd>{data.tokenStatus}</dd>
            </div>
            {!data.ownerAuthorized && <div className="text-muted-foreground sm:col-span-2">
              상세 DB·수집 진단은 소유자 로그인 후 확인할 수 있습니다. DB 연결·스키마·이력은 미점검이며, 공개 시장자료 읽기 권한과 별개입니다.
            </div>}
          </dl>
          {data.ownerAuthorized && (
            <>
            <section data-testid="kiwoom-collector-runtime" className="rounded-xl border border-border bg-card p-4 text-sm">
              <h2 className="font-semibold">고정 IP 수집기 · {data.collector?.state ?? "UNKNOWN"}</h2>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <div><dt className="text-muted-foreground">마지막 heartbeat</dt><dd data-testid="kiwoom-collector-heartbeat">{collectorTime(data.collector?.lastHeartbeatAt)}</dd></div>
                <div><dt className="text-muted-foreground">마지막 정상 주기</dt><dd>{collectorTime(data.collector?.lastSuccessAt)}</dd></div>
                <div><dt className="text-muted-foreground">처리 가능한 대기 대상</dt><dd>{data.collector?.pendingTargets ?? "미확인"}</dd></div>
                <div><dt className="text-muted-foreground">마지막 안전한 오류 코드</dt><dd>{data.collector?.lastErrorCode ?? "없음"}</dd></div>
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">최근 heartbeat 기준: 10분 이내 RUNNING, 30분 이내 STALE, 이후 OFFLINE. 기록이 없거나 점검할 수 없으면 UNKNOWN이며, 실제 API 수신 성공과는 별개입니다.</p>
            </section>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="p-3">지표</th>
                    <th>최종 관측일</th>
                    <th>유효 값</th>
                    <th>저장 작업 상태</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.metrics).map(([metric, row]) => (
                    <tr key={metric}>
                      <td className="p-3">
                        {metric === "credit"
                          ? "신용잔고율"
                          : metric === "foreign"
                            ? "외국인보유비율"
                            : "투신 순매수"}
                      </td>
                      <td>{row.lastDate ?? "없음"}</td>
                      <td>{row.validValues}</td>
                      <td>{KIWOOM_HEALTH_LABELS[row.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
          <p className="text-xs text-muted-foreground">
            collector 웹앱은 키움 인증정보 없이 공유 DB만 읽습니다. 실수신 검증은 허용 IP의
            수집기에서 별도로 실행하세요.
          </p>
        </>
      )}
    </div>
  );
}
