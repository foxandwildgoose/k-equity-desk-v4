import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isOpenDartConnected, type OpenDartStatus } from "@/lib/opendart-status";
import { cn } from "@/lib/utils";

const STATE_LABEL: Record<OpenDartStatus["state"], string> = {
  ok: "연결됨",
  empty: "연결됨 · 조회 기간 내 공시 없음",
  "missing-key": "미설정",
  "invalid-key": "인증 확인 필요",
  "rate-limited": "조회 제한",
  unavailable: "연결 확인 실패",
  "company-not-found": "기업 연결 미확인",
  "invalid-request": "조회 조건 오류",
};

/** Shows server-reported authentication and fallback state, never credentials. */
export function OpenDartConnectionStatus({
  status,
  className,
}: {
  status?: OpenDartStatus | null;
  className?: string;
}) {
  if (!status) return null;

  const connected = status.configured && isOpenDartConnected(status);
  const Icon = connected ? CheckCircle2 : status.state === "missing-key" ? Info : AlertTriangle;
  const checkedDate = new Date(status.checkedAt);
  const checkedAt = Number.isFinite(checkedDate.getTime())
    ? checkedDate.toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="opendart-status"
      data-state={status.state}
      className={cn(
        "flex min-w-0 items-start gap-2 rounded-lg border border-border bg-card px-3 py-3 text-xs text-foreground",
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "mt-0.5 size-4 shrink-0",
          connected ? "text-desk-teal" : "text-muted-foreground",
        )}
      />
      <div className="min-w-0 flex-1 break-words">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">OpenDART</span>
          <Badge
            variant="secondary"
            className={cn(
              "whitespace-normal border-0",
              connected ? "chip-teal" : "bg-muted text-muted-foreground",
            )}
          >
            {STATE_LABEL[status.state]}
          </Badge>
        </div>
        <p className="mt-1 leading-relaxed text-muted-foreground">{status.message}</p>
        {status.fallbackUsed && (
          <p className="mt-1 leading-relaxed text-muted-foreground">
            DART 웹 공시를 대체 소스로 조회했습니다.
          </p>
        )}
        {checkedAt && (
          <p className="mt-1 tabular-nums text-muted-foreground">
            상태 확인 <time dateTime={status.checkedAt}>{checkedAt}</time> (한국시간)
          </p>
        )}
      </div>
    </div>
  );
}
