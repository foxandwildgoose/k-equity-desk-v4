/** Read-only verification; never reads credentials. Sequential, bounded pages. */
const origin = new URL(process.argv[2] ?? "https://k-equity-desk-v4.vercel.app");
if (origin.origin !== origin.href.replace(/\/$/, "") || origin.username || origin.password || origin.protocol !== "https:") throw Error("Expected HTTPS origin");
const codes = "373220,006400,096770,005490,051910,003670,247540,086520,011790,066970,020150,450080,078600,361610,005070,093370,036830,121600,137400,222080,336370,348370,278280,365340,005420,393890,243840".split(",");
const results = [];
let stop = false;
const startedAt = new Date().toISOString();
for (const code of codes) {
  if (stop) { results.push({ code, state: "not-attempted" }); continue; }
  let page = 1, total = null, totalPages = null;
  const receipts = new Set();
  let sample;
  try {
    for (;;) {
      const url = new URL("/api/disclosures", origin);
      url.search = new URLSearchParams({ code, begin: "2026-10-17", end: "2026-10-20", page: String(page), pageSize: "100" });
      const response = await fetch(url, { signal: AbortSignal.timeout(60000), redirect: "error" });
      if (!response.ok) { results.push({ code, state: "http-error", httpStatus: response.status, page }); stop = [401,403,429,503].includes(response.status); break; }
      const body = await response.json();
      const p = body.pagination;
      if (!["ok","empty"].includes(body.status?.state) || body.status.fallbackUsed || !p || p.page !== page || p.pageSize !== 100 || !Array.isArray(body.items) || (total !== null && (p.totalCount !== total || p.totalPages !== totalPages))) throw Error("contract-or-live-totals-changed");
      total = p.totalCount; totalPages = p.totalPages;
      for (const row of body.items) {
        if (row.stockCode !== code || !/^\d{14}$/.test(row.receiptNo) || receipts.has(row.receiptNo)) throw Error("identity-or-page-overlap");
        receipts.add(row.receiptNo);
        sample ??= { receiptNo: row.receiptNo, receiptDate: row.receiptDate, corpName: row.corpName, reportName: row.reportName, dartUrl: row.dartUrl };
      }
      if (p.nextPage === null) {
        if (!p.complete || !body.complete || receipts.size !== total) throw Error("incomplete-count");
        results.push({ code, state: "complete", pagesFetched: page, totalCount: total, checkedAt: body.status.checkedAt, sample });
        break;
      }
      if (p.nextPage !== page + 1 || p.complete || page >= 1000) throw Error("invalid-next-page");
      page++;
    }
  } catch {
    // Never serialize raw transport errors, response bodies, headers or credentials.
    results.push({ code, state: "transport-or-contract-error", page, uniqueReceipts: receipts.size });
    stop = true;
  }
}
console.log(JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), origin: origin.origin, begin: "2026-10-17", end: "2026-10-20", timezone: "Asia/Seoul", completed: results.filter(r => r.state === "complete").length, results }, null, 2));
process.exitCode = results.every(r => r.state === "complete") ? 0 : 1;
