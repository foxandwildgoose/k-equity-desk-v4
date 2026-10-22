import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createMotieReleaseClient,
  extractMotiePdfText,
  parseMotieArticles,
  parseMotieHtmlItems,
  parseMotieTextItems,
  MOTIE_RELEASE_LIST_URL,
} from "./export-motie.ts";

const NOW = new Date("2026-10-22T08:00:00Z");
const TITLE = "2026년 9월 수출입 동향";
const DETAIL = "https://www.motir.go.kr/kor/article/ATCL3f49a5a8c/123456/view";
const LIST = "<a href=\"javascript:article.view('123456');\">" + TITLE + "</a>";
const TABLE =
  "<p>MTI 기준 주요 품목별 수출실적 · 단위: 백만 달러</p><table><caption>2026년 9월</caption><tr><th>품목</th><th>수출액</th><th>전년동월비</th></tr><tr><td>자동차</td><td>1,234.5</td><td>△2.5</td></tr><tr><td>가전</td><td>0</td><td>0</td></tr></table>";
function detail(body = TABLE, extra = "") {
  return (
    "<h1>" +
    TITLE +
    '</h1><p>등록일 | 2026.10.01</p><div itemprop="articleBody">' +
    body +
    "</div>" +
    extra
  );
}
function fixture(
  body = detail(),
  dependencies: Parameters<typeof createMotieReleaseClient>[0] = {},
) {
  const calls: string[] = [];
  const client = createMotieReleaseClient({
    now: () => NOW,
    ...dependencies,
    fetch: (async (input, init) => {
      const url = String(input);
      calls.push(url);
      assert.equal(init?.redirect, "manual");
      assert.equal(init?.cache, "no-store");
      assert.ok(init?.signal);
      assert.equal(new Headers(init?.headers).has("authorization"), false);
      return new Response(url.includes("/view") ? body : LIST);
    }) as typeof fetch,
  });
  return { calls, client };
}

test("discovers only exact monthly releases on the official board without guessed IDs", () => {
  const html =
    LIST +
    "<a href=\"javascript:article.view('333')\">2026년 9월 1~20일 수출입 동향</a>" +
    "<a href=\"javascript:article.view('334')\">2026년 10월 수출입 동향</a>" +
    '<a href="https://evil.invalid/kor/article/ATCL3f49a5a8c/444/view">2026년 8월 수출입 동향</a>' +
    '<a href="javascript:void(0)" onclick="article.view(\'111\')">2026년 8월 수출입 동향</a>';
  const rows = parseMotieArticles(html, MOTIE_RELEASE_LIST_URL, NOW);
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((r) => r.period),
    ["2026-09", "2026-08"],
  );
  assert.equal(rows[0]!.url, DETAIL);
  assert.throws(() => parseMotieArticles(html, "https://evil.invalid", NOW), /검증/);
});

test("explicit monthly MTI amount columns scale million USD once and preserve observed zero", () => {
  const rows = parseMotieHtmlItems(TABLE, "2026-09");
  assert.deepEqual(rows, [
    { categoryId: "automobiles", label: "자동차", valueUsd: 1_234_500_000, yoyPct: -2.5 },
    { categoryId: "home_appliances", label: "가전", valueUsd: 0, yoyPct: 0 },
  ]);
});

test("table parser rejects unknown units, wrong periods, imports and unverified classification", () => {
  for (const body of [
    TABLE.replace("백만 달러", "억원"),
    TABLE.replace("2026년 9월", "2026년 8월"),
    TABLE.replace("MTI 기준", "HS 프리뷰"),
    TABLE.replace("수출실적", "수입실적"),
    TABLE.replace("수출실적", "누계 수출실적"),
  ])
    assert.deepEqual(parseMotieHtmlItems(body, "2026-09"), []);
});

test("a current-month header is selected by identity rather than by position", () => {
  const table =
    "<p>MTI 주요품목 수출 · 단위: 억 달러</p><table><tr><th>품목</th><th>2025년9월</th><th>2026년9월</th></tr><tr><td>자동차부품</td><td>30</td><td>31</td></tr></table>";
  assert.equal(parseMotieHtmlItems(table, "2026-09")[0]!.valueUsd, 3_100_000_000);
  assert.deepEqual(parseMotieHtmlItems(table.replace("2026년9월", "전망"), "2026-09"), []);
});

test("conflicting exact category observations are excluded instead of choosing a number", () => {
  const rows = parseMotieHtmlItems(TABLE + TABLE.replace("1,234.5", "1,250.0"), "2026-09");
  assert.equal(
    rows.some((r) => r.categoryId === "automobiles"),
    false,
  );
  assert.equal(rows.find((r) => r.categoryId === "home_appliances")!.valueUsd, 0);
});

test("inline amounts need the same monthly document, MTI definition and export section", () => {
  const text =
    TITLE +
    "\nMTI 기준 주요품목 수출실적\n반도체(100.5억 달러)\n자동차: 52억 달러\n자동차부품(12억 달러)";
  const rows = parseMotieTextItems(text, "2026-09");
  assert.equal(rows.length, 3);
  assert.equal(rows.find((r) => r.categoryId === "automobiles")!.valueUsd, 5_200_000_000);
  assert.equal(rows.find((r) => r.categoryId === "auto_parts")!.valueUsd, 1_200_000_000);
  assert.deepEqual(parseMotieTextItems(text, "2026-08"), []);
  assert.deepEqual(parseMotieTextItems(text.replace("MTI", "HS"), "2026-09"), []);
  assert.deepEqual(
    parseMotieTextItems(text.replace("주요품목 수출실적", "일반 경제뉴스"), "2026-09"),
    [],
  );
});

test("prior-year, different-month, cumulative, import and forecast figures never fill current cards", () => {
  const text =
    TITLE +
    "\nMTI 기준 주요품목 수출실적\n" +
    "자동차: 52억 달러 전년 금액\n" +
    "가전: 3억 달러 누계\n" +
    "반도체: 100억 달러 전망\n" +
    "이차전지: 9억 달러 수입\n" +
    "2025년 9월\n섬유: 7억 달러\n" +
    "2026년 8월\n선박: 6억 달러\n";
  assert.deepEqual(parseMotieTextItems(text, "2026-09"), []);
});

test("a named export paragraph needs exactly one current amount with an explicit USD scale", () => {
  const prefix = TITLE + "\nMTI 주요품목 수출실적\n";
  const rows = parseMotieTextItems(
    prefix + "(자동차) 수출은 전년 동월 대비 3% 증가한 52.3억 달러를 기록했다.",
    "2026-09",
  );
  assert.equal(rows[0]!.categoryId, "automobiles");
  assert.equal(rows[0]!.valueUsd, 5_230_000_000);
  assert.deepEqual(
    parseMotieTextItems(prefix + "(자동차) 수출 52억 달러, 50억 달러보다 늘었다.", "2026-09"),
    [],
  );
});

test("the client exposes validated MTI observations and the exact official source link", async () => {
  const { client, calls } = fixture();
  const value = await client();
  assert.equal(calls.length, 2);
  assert.equal(value.provider.state, "ok");
  assert.equal(value.provider.recordCount, 2);
  assert.equal(value.provider.asOf, "2026-09");
  assert.equal(value.release?.url, DETAIL);
  assert.equal(value.release?.publishedAt, "2026-10-01");
  assert.ok(
    value.observations.every(
      (r) =>
        r.classification === "MTI" &&
        r.releasedAt === "2026-10-01" &&
        r.sourceFile.includes(DETAIL),
    ),
  );
});

test("a real bulletin without verified amounts stays partial and retains its direct link", async () => {
  const { client } = fixture(detail("<p>공식 월간 발표 원문입니다.</p>"));
  const value = await client();
  assert.equal(value.release?.url, DETAIL);
  assert.equal(value.provider.state, "partial");
  assert.equal(value.provider.reasonCode, "OFFICIAL_RELEASE_NUMBERS_UNVERIFIED");
  assert.equal(value.provider.recordCount, 0);
  assert.deepEqual(value.observations, []);
});

test("related-article/footer numbers are not parsed as the current bulletin body", async () => {
  const { client } = fixture(
    detail("<p>품목 금액이 없습니다.</p>", "<footer>" + TABLE + "</footer>"),
  );
  const value = await client();
  assert.equal(value.provider.recordCount, 0);
  assert.deepEqual(value.observations, []);
});

test("known publication dates must follow the completed reference month and cannot be future", async () => {
  for (const date of ["2026.09.15", "2026.10.23"]) {
    const { client } = fixture(detail().replace("2026.10.01", date));
    const value = await client();
    assert.equal(value.provider.state, "unverified");
    assert.equal(value.provider.recordCount, 0);
    assert.deepEqual(value.observations, []);
  }
});

test("foreign redirects are rejected without issuing a request to the other host", async () => {
  const calls: string[] = [];
  const client = createMotieReleaseClient({
    now: () => NOW,
    fetch: (async (url) => {
      calls.push(String(url));
      return new Response(null, { status: 302, headers: { location: "https://evil.invalid/x" } });
    }) as typeof fetch,
  });
  const value = await client();
  assert.equal(value.provider.reasonCode, "REDIRECT_SOURCE_IDENTITY");
  assert.equal(
    calls.some((u) => u.includes("evil.invalid")),
    false,
  );
});

test("PDF attachment must be discovered from the real page and match its statistical month", async () => {
  let calls = 0;
  const client = createMotieReleaseClient({
    now: () => NOW,
    fetch: (async (input) => {
      calls++;
      const url = String(input);
      if (url.endsWith("/source.pdf")) return new Response("%PDF-fixture bytes");
      if (url.includes("/view"))
        return new Response(
          detail("<p>본문은 PDF 첨부에 있습니다.</p>", '<a href="/source.pdf">보도자료.pdf</a>'),
        );
      return new Response(LIST);
    }) as typeof fetch,
    extractPdfText: async () => "2025년 9월 수출입 동향\nMTI 주요품목 수출실적\n자동차(52억 달러)",
  });
  const value = await client();
  assert.equal(calls, 3);
  assert.equal(value.release?.attachmentUrl, "https://www.motir.go.kr/source.pdf");
  assert.equal(value.provider.reasonCode, "ATTACHMENT_PERIOD_IDENTITY");
  assert.equal(value.provider.state, "partial");
  assert.equal(value.observations.length, 0);
});

test("a stalled PDF decoder cannot outlive the complete acquisition budget", async () => {
  const keepAlive = setTimeout(() => {}, 1000);
  const start = Date.now();
  try {
    const client = createMotieReleaseClient({
      now: () => NOW,
      budgetMs: 35,
      fetch: (async (input) =>
        new Response(
          String(input).endsWith("/source.pdf")
            ? "%PDF-fixture bytes"
            : String(input).includes("/view")
              ? detail("", '<a href="/source.pdf">보고서.pdf</a>')
              : LIST,
        )) as typeof fetch,
      extractPdfText: async () => new Promise(() => {}),
    });
    const result = await client();
    assert.ok(Date.now() - start < 300);
    assert.equal(result.provider.state, "partial");
    assert.equal(result.provider.reasonCode, "REQUEST_TIMEOUT");
    assert.equal(result.observations.length, 0);
  } finally {
    clearTimeout(keepAlive);
  }
});

test("verified cache returns caller clones and a failed refresh keeps original verification time", async () => {
  let time = NOW.getTime();
  let failing = false;
  let calls = 0;
  const client = createMotieReleaseClient({
    now: () => new Date(time),
    fetch: (async (input) => {
      calls++;
      if (failing) return new Response("temporarily unavailable", { status: 503 });
      return new Response(String(input).includes("/view") ? detail() : LIST);
    }) as typeof fetch,
  });
  const first = await client();
  first.observations[0]!.valueUsd = 1;
  const second = await client();
  assert.equal(second.observations[0]!.valueUsd, 1_234_500_000);
  assert.equal(calls, 2);
  time += 5 * 3_600_000;
  failing = true;
  const stale = await client();
  assert.equal(stale.provider.state, "stale");
  assert.equal(stale.provider.checkedAt, NOW.toISOString());
  assert.equal(stale.observations[0]!.valueUsd, 1_234_500_000);
});

test("a reachable bulletin whose numbers stop validating does not erase the verified snapshot", async () => {
  let time = NOW.getTime();
  let body = detail();
  const client = createMotieReleaseClient({
    now: () => new Date(time),
    fetch: (async (input) =>
      new Response(String(input).includes("/view") ? body : LIST)) as typeof fetch,
  });
  const first = await client();
  time += 5 * 3_600_000;
  body = detail("<p>새 첨부파일의 수치는 아직 검증되지 않았습니다.</p>");
  const retained = await client();
  assert.equal(retained.provider.state, "stale");
  assert.equal(retained.provider.checkedAt, first.provider.checkedAt);
  assert.equal(retained.observations[0]!.valueUsd, first.observations[0]!.valueUsd);
});

function tinyPdf(text: string): Uint8Array {
  const stream = "BT /F1 12 Tf 72 720 Td (" + text + ") Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += index + 1 + " 0 obj\n" + object + "\nendobj\n";
  });
  const start = Buffer.byteLength(pdf);
  pdf += "xref\n0 6\n0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) pdf += String(offset).padStart(10, "0") + " 00000 n \n";
  pdf += "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + start + "\n%%EOF";
  return new Uint8Array(Buffer.from(pdf));
}
test("the actual PDF.js extractor reads a generated PDF with the explicit bundled worker", async () => {
  const bytes = tinyPdf("MOTIE fixture only 2026-09");
  const copy = bytes.slice();
  const text = await extractMotiePdfText(bytes, AbortSignal.timeout(5000));
  assert.match(text, /MOTIE fixture only 2026-09/);
  assert.deepEqual(bytes, copy);
});

test("the PDF extractor rejects format and size before loading document code", async () => {
  await assert.rejects(
    extractMotiePdfText(
      new Uint8Array(Buffer.from("<html>not a PDF</html>")),
      AbortSignal.timeout(1000),
    ),
    /검증/,
  );
  await assert.rejects(
    extractMotiePdfText(new Uint8Array(8_000_001), AbortSignal.timeout(1000)),
    /검증/,
  );
});
