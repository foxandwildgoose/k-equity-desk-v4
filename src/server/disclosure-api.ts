import { fetchOpenDartDisclosures } from "./opendart.ts";

/** Stable read-only API. Dates are inclusive KST receipt dates, not timestamps. */
export async function disclosureResponse(request: Request, fetchPage = fetchOpenDartDisclosures) {
  const params = new URL(request.url).searchParams;
  const allowed = new Set(["code", "begin", "end", "page", "pageSize"]);
  const code = params.get("code") ?? "";
  const begin = params.get("begin") ?? "";
  const end = params.get("end") ?? "";
  const page = params.get("page") ?? "1";
  const pageSize = params.get("pageSize") ?? "100";
  const date = (s: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s;
  if (
    [...params.keys()].some((k) => !allowed.has(k) || params.getAll(k).length !== 1) ||
    !/^[0-9A-Z]{6}$/.test(code) ||
    !date(begin) ||
    !date(end) ||
    begin > end ||
    end > new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10) ||
    Date.parse(end) - Date.parse(begin) > 120 * 86400000 ||
    !/^[1-9]\d{0,3}$/.test(page) ||
    Number(page) > 1000 ||
    !/^[1-9]\d{0,2}$/.test(pageSize) ||
    Number(pageSize) > 100
  ) {
    return Response.json(
      { error: "invalid-request", complete: false },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const result = await fetchPage({
    stockCode: code,
    range: {
      begin: begin.replaceAll("-", ""),
      end: end.replaceAll("-", ""),
      page: Number(page),
      pageSize: Number(pageSize),
    },
  });
  const ok = ["ok", "empty"].includes(result.status.state) && !!result.pagination;
  const status = ok
    ? 200
    : result.status.state === "invalid-request"
      ? 400
      : result.status.state === "rate-limited"
        ? 429
        : 503;
  return Response.json(
    {
      source: "OpenDART",
      query: {
        code,
        begin,
        end,
        page: Number(page),
        pageSize: Number(pageSize),
        timezone: "Asia/Seoul",
      },
      status: result.status,
      items: result.items.map((item) => ({
        ...item,
        dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.receiptNo}`,
      })),
      pagination: result.pagination ?? null,
      complete: ok && result.pagination!.complete,
    },
    {
      status,
      headers: {
        "Cache-Control": ok ? "public, s-maxage=60" : "no-store",
        ...(status === 429 ? { "Retry-After": "60" } : {}),
      },
    },
  );
}
