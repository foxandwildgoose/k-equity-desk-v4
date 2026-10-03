import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageDisclaimer } from "@/components/feed/PageDisclaimer";
import { EtfNewsDesk } from "@/components/etf/EtfNewsDesk";

export const Route = createFileRoute("/news/etf")({
  component: EtfNewsPage,
  head: () => ({ meta: [{ title: "ETF 뉴스 브리핑 · Korea Equity Command Center" }] }),
});

function EtfNewsPage() {
  return (
    <div className="page-stack">
      <PageHeader
        kicker="KR ETF News Briefing · 국내 ETF"
        title="ETF 뉴스 브리핑"
        lead="ETF 신규 상장·상장 예정·상장폐지·자금 흐름·퇴직연금 기사를 Google 뉴스(주제·운용사별), 한국경제 증권 RSS(ETF 키워드), 네이버 뉴스 검색에서 모아 최신순으로 보여줍니다. 기사 속 ETF는 실시간 ETF 목록과 이름으로 맞춰 코드·시세를 붙입니다."
      />
      <PageDisclaimer />
      <EtfNewsDesk />
    </div>
  );
}
