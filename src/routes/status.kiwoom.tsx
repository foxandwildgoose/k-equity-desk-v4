import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getKiwoomDiagnostics } from "@/lib/kiwoom-diagnostic-fns";
import { KIWOOM_HEALTH_LABELS, KIWOOM_NEXT_STEPS } from "@/lib/charts/hts-flow";

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
        lead="설정 여부와 저장된 삼성전자 이력을 점검합니다. 토큰 발급·수집·DB 마이그레이션은 실행하지 않습니다."
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
            {KIWOOM_HEALTH_LABELS[data.status]} · {data.mode} · {data.environment}
          </p>
          <p className="text-sm" data-testid="kiwoom-next-step">{KIWOOM_NEXT_STEPS[data.status]}</p>
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
              <dt>출발 IP 확인</dt>
              <dd>{data.egressStatus}</dd>
            </div>
            <div>
              <dt>토큰 확인</dt>
              <dd>{data.tokenStatus}</dd>
            </div>
            {!data.ownerAuthorized && <p className="text-muted-foreground">상세 DB·수집 진단은 소유자 로그인 후 확인할 수 있습니다. 공개 시장자료 읽기 권한과 별개입니다.</p>}
          </dl>
          {data.ownerAuthorized && (
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
