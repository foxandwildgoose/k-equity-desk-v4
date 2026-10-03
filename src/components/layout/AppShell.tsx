import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, Moon, Sun, Palette } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { MarketBar } from "./MarketBar";
import { SearchCommand } from "./SearchCommand";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAppStore } from "@/lib/store";
import { Toaster } from "sonner";
import { LiveWireButton, LiveWireDrawer, LiveWireRunner, TickerTape } from "@/components/wire/LiveWire";
import {
  CHART_ATTRIBUTION_LABEL,
  CHART_ATTRIBUTION_URL,
  LIGHTWEIGHT_CHARTS_NOTICE,
} from "@/components/charts/core/attribution";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AppShell({ children }: { children: React.ReactNode }) {
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const colorConvention = useAppStore((s) => s.colorConvention);
  const setColorConvention = useAppStore((s) => s.setColorConvention);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="app-shell bg-background text-foreground">
        <div
          className="app-shell-banner shrink-0"
          style={{ height: "var(--grok-banner-h, 0px)" }}
        />

        <header className="app-shell-top shell-header z-40">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 h-12 px-3 md:grid-cols-[15rem_minmax(0,1fr)_auto] md:px-4">
            <div className="flex items-center gap-2 min-w-0">
              <Button
                variant="ghost"
                size="icon-sm"
                className="md:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="메뉴 열기"
              >
                <Menu className="size-4" />
              </Button>

              <Link
                to="/"
                className="md:hidden flex items-center gap-2 font-semibold text-sm tracking-tight"
              >
                <span className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-desk-gold to-amber-700 text-[11px] font-bold text-black shadow-sm">
                  KX
                </span>
                <span className="leading-tight">
                  Equity
                  <span className="block text-[9px] font-medium text-muted-foreground tracking-wider uppercase">
                    Command
                  </span>
                </span>
              </Link>
              <div className="hidden md:block" />
            </div>

            <SearchCommand className="min-w-0 max-w-xl mx-auto w-full" />

            <div className="flex items-center justify-end gap-0.5">
              <LiveWireButton />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      setColorConvention(
                        colorConvention === "korea" ? "global" : "korea",
                      )
                    }
                    aria-label="등락 색상 전환"
                  >
                    <Palette className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {colorConvention === "korea"
                    ? "한국식 (빨강↑ 파랑↓) → 글로벌"
                    : "글로벌 (초록↑ 빨강↓) → 한국식"}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={toggleTheme}
                    aria-label="테마 전환"
                  >
                    {theme === "dark" ? (
                      <Sun className="size-3.5" />
                    ) : (
                      <Moon className="size-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {theme === "dark" ? "라이트 모드" : "다크 모드"}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          <MarketBar />
        </header>

        <div className="app-shell-body">
          <Sidebar className="hidden md:flex min-h-0" />

          <main className="app-shell-main scroll-thin bg-background">
            <div className="app-shell-content desk-page mx-auto w-full max-w-[1440px] px-4 py-5 md:px-7 md:py-7">
              {children}
            </div>
            <footer className="border-t border-border bg-panel/90 px-4 py-3 md:px-7">
              <p className="mx-auto max-w-[1440px] text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-semibold text-desk-gold">면책 · </span>
                Korea Equity Command Center는 정보·리서치 워크플로 도구이며 투자
                자문·매매 권유·주문 실행 서비스가 아닙니다. 시세·차트·수급·리포트는
                제3자 경로(KIS/KRX·네이버·Yahoo·DART 등)에 의존하며 지연·누락·오류가
                있을 수 있습니다. 투자 결정과 손실 책임은 이용자 본인에게 있습니다.
                실주문 전 증권사 HTS/MTS에서 호가·잔량·VI·공시를 재확인하세요.
              </p>
              <p className="mx-auto mt-1.5 max-w-[1440px] text-[11px] leading-relaxed text-muted-foreground">
                <a
                  href={CHART_ATTRIBUTION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground/80 underline-offset-2 hover:underline"
                  data-testid="chart-attribution"
                  title={LIGHTWEIGHT_CHARTS_NOTICE}
                >
                  {CHART_ATTRIBUTION_LABEL}
                </a>
                <span className="whitespace-pre-line"> · {LIGHTWEIGHT_CHARTS_NOTICE.replace("\n", " · ")}</span>
                <span> · </span>
                <Link to="/status/sources" className="underline-offset-2 hover:underline">
                  소스 상태
                </Link>
              </p>
            </footer>
            <div className="sticky bottom-0 z-30">
              <TickerTape />
            </div>
          </main>
        </div>

        <LiveWireRunner />
        <LiveWireDrawer />

        <Toaster
          theme={theme}
          position="bottom-right"
          closeButton
          toastOptions={{ className: "text-sm" }}
        />

        {/* Mobile sidebar */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>메뉴</SheetTitle>
            </SheetHeader>
            <Sidebar
              className="w-full border-0"
              onNavigate={() => setSidebarOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}
