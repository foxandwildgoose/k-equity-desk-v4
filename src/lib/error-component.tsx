import { useEffect, useState } from "react";
import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { Home, RefreshCw, RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clientErrorMessage, isClientChunkFailure, tryAutomaticChunkRecovery } from "@/lib/client-recovery";

export function AppErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter({ warn: false });
  const [retrying, setRetrying] = useState(false);
  const chunkFailure = isClientChunkFailure(error);

  useEffect(() => {
    tryAutomaticChunkRecovery(error, window);
  }, [error]);

  async function retry() {
    setRetrying(true);
    try {
      await router?.invalidate();
    } catch {
      // The boundary will continue to show the actual error if retry fails.
    } finally {
      setRetrying(false);
      reset();
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
      <section role="alert" aria-labelledby="app-error-title" className="w-full max-w-lg space-y-4 rounded-lg border border-border bg-card p-5 text-card-foreground" data-testid="app-error-panel">
        <TriangleAlert className="size-8 text-desk-gold" aria-hidden="true" />
        <h1 id="app-error-title" className="text-lg font-semibold">
          {chunkFailure ? "화면 파일을 불러오지 못했습니다" : "화면을 불러오지 못했습니다"}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {chunkFailure
            ? "배포가 갱신되었거나 연결이 일시적으로 끊겼을 수 있습니다. 페이지를 새로고침해 주세요."
            : "다시 시도하거나 첫 화면으로 이동할 수 있습니다."}
        </p>
        <p className="rounded-md border border-border bg-muted/30 p-3 text-sm break-all text-muted-foreground" data-testid="app-error-message">
          {clientErrorMessage(error)}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button type="button" size="lg" onClick={() => { void retry(); }} disabled={retrying}>
            <RotateCcw aria-hidden="true" />{retrying ? "다시 시도 중…" : "다시 시도"}
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={() => window.location.reload()}>
            <RefreshCw aria-hidden="true" />페이지 새로고침
          </Button>
          <Button asChild variant="ghost" size="lg">
            <a href="/"><Home aria-hidden="true" />첫 화면으로</a>
          </Button>
        </div>
      </section>
    </main>
  );
}
