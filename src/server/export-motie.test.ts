import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createMotieReleaseClient,
  extractMotiePdfText,
  parseMotieArticles,
  parseMotieHtmlItems,
  parseMotieTextItems,
  motiePdfFailureReason,
  motieTextDiagnostics,
  resolveMotiePdfAssets,
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

test("regional, country, quarterly and cumulative tables cannot fill national monthly cards", () => {
  for (const scope of [
    "국가별 수출실적",
    "미국 주요품목 수출",
    "2026년 3분기 수출",
    "수출 누계",
    "상반기 수출",
    "일평균 수출",
    "2026년 1~9월 수출",
  ]) {
    assert.deepEqual(
      parseMotieHtmlItems(TABLE.replace("주요 품목별 수출실적", scope), "2026-09"),
      [],
    );
  }
});

test("later nonnational or cumulative sections reset inherited monthly export context", () => {
  const prefix = TITLE + "\nMTI 주요품목 수출실적\n반도체(100억 달러)\n";
  for (const scope of [
    "국가별 수출실적",
    "미국 수출",
    "2026년 3분기 수출",
    "누계 수출",
    "상반기 수출",
    "일평균 수출",
    "2026년 1~9월 수출",
  ]) {
    const text = prefix + scope + "\n자동차: 12억 달러\n";
    const rows = parseMotieTextItems(text, "2026-09");
    assert.deepEqual(
      rows.map((r) => r.categoryId),
      ["semiconductors"],
    );
    const restored = parseMotieTextItems(
      text + "2026년 9월 주요품목 수출실적\n가전: 3억 달러",
      "2026-09",
    );
    assert.equal(
      restored.some((r) => r.categoryId === "home_appliances"),
      true,
    );
    assert.equal(
      restored.some((r) => r.categoryId === "automobiles"),
      false,
    );
  }
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

test("public PDF failure categories identify known runtime stages without exposing exception text", () => {
  const cases: [Error, string][] = [
    [new ReferenceError("DOMMatrix is not defined"), "PDF_DOM_POLYFILL_MISSING"],
    [new Error("Cannot find package private-package"), "PDF_RUNTIME_DEPENDENCY_MISSING"],
    [new Error("Setting up fake worker failed"), "PDF_WORKER_INIT_FAILED"],
    [
      new Error('The API version "4" does not match the Worker version "5"'),
      "PDF_WORKER_VERSION_MISMATCH",
    ],
    [
      new Error("Ensure that the standardFontDataUrl API parameter is provided"),
      "PDF_FONT_RESOURCE_UNAVAILABLE",
    ],
    [new Error("Unable to read CMap"), "PDF_FONT_RESOURCE_UNAVAILABLE"],
    [new Error("WebAssembly module was not loaded"), "PDF_WASM_RESOURCE_UNAVAILABLE"],
    [new Error("Promise.withResolvers is not a function"), "PDF_NODE_API_UNAVAILABLE"],
    [new DOMException("private upstream text", "TimeoutError"), "PDF_DECODE_TIMEOUT"],
    [new Error("secret fixture text must never be public"), "PDF_TEXT_FAILED"],
  ];
  for (const [error, expected] of cases)
    assert.equal(motiePdfFailureReason(error, "TEXT"), expected);
});

test("normal source-health diagnostics return only bounded semantic booleans, counts and scale enums", () => {
  const diagnostics = motieTextDiagnostics(
    TITLE +
      "\nMTI 주요품목 수출실적\n자동차부품(10억 달러)\n반도체: 100억 달러\nprivate unrelated fixture",
    "2026-09",
  );
  assert.deepEqual(diagnostics, {
    matchingPeriod: true,
    mtiDefinition: true,
    exportSection: true,
    knownCategoryCount: 2,
    explicitCurrencyAmountCount: 2,
    usdScales: ["USD_100M"],
  });
  assert.equal(JSON.stringify(diagnostics).includes("private"), false);
});

test("a PDF fetch timeout is distinct from decoder failure and retains the official article link", async () => {
  const client = createMotieReleaseClient({
    now: () => NOW,
    fetch: (async (input) => {
      const url = String(input);
      if (url.endsWith("/source.pdf"))
        throw new DOMException("private request context", "TimeoutError");
      return new Response(
        url.includes("/view") ? detail("", '<a href="/source.pdf">보도자료.pdf</a>') : LIST,
      );
    }) as typeof fetch,
  });
  const result = await client();
  assert.equal(result.provider.reasonCode, "ATTACHMENT_REQUEST_TIMEOUT");
  assert.equal(result.provider.state, "partial");
  assert.equal(result.release?.url, DETAIL);
  assert.equal(result.diagnostics?.stage, "attachment-request");
  assert.equal(JSON.stringify(result).includes("private request context"), false);
});

test("an interrupted attachment body is reported separately from decode and font errors", async () => {
  const client = createMotieReleaseClient({
    now: () => NOW,
    fetch: (async (input) => {
      const url = String(input);
      if (url.endsWith("/source.pdf"))
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new TypeError("private transport failure"));
            },
          }),
        );
      return new Response(
        url.includes("/view") ? detail("", '<a href="/source.pdf">보도자료.pdf</a>') : LIST,
      );
    }) as typeof fetch,
  });
  const result = await client();
  assert.equal(result.provider.reasonCode, "ATTACHMENT_BODY_READ_FAILED");
  assert.equal(result.diagnostics?.stage, "attachment-request");
  assert.equal(result.observations.length, 0);
  assert.equal(JSON.stringify(result).includes("private transport failure"), false);
});

function delayedAttachmentClient(
  config: Parameters<typeof createMotieReleaseClient>[0],
  delayMs: number,
  stallCancel = false,
) {
  let cancelled = false;
  const client = createMotieReleaseClient({
    now: () => NOW,
    budgetMs: 5000,
    ...config,
    fetch: (async (input) => {
      const url = String(input);
      if (url.endsWith("/source.pdf")) {
        let timer: ReturnType<typeof setTimeout>;
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              timer = setTimeout(() => {
                controller.enqueue(new TextEncoder().encode("%PDF-test-only delayed body"));
                controller.close();
              }, delayMs);
            },
            cancel() {
              cancelled = true;
              clearTimeout(timer);
              if (stallCancel) return new Promise<void>(() => {});
            },
          }),
        );
      }
      return new Response(
        url.includes("/view") ? detail("", '<a href="/source.pdf">보도자료.pdf</a>') : LIST,
      );
    }) as typeof fetch,
    extractPdfText: async () => TITLE + "\nMTI 주요품목 수출실적\n자동차: 52억 달러",
  });
  return { client, wasCancelled: () => cancelled };
}

test("fast HTML and a slower PDF body use independent bounded request windows", async () => {
  // Scaled equivalent of the 7-second HTML vs 25-second PDF policy:
  // a 60ms body cannot fit the 20ms HTML window but fits the PDF's 200ms window.
  const { client } = delayedAttachmentClient({ htmlTimeoutMs: 20, attachmentTimeoutMs: 200 }, 60);
  const start = Date.now();
  const result = await client();
  assert.equal(result.provider.state, "ok");
  assert.equal(result.provider.reasonCode, "OFFICIAL_RELEASE_VERIFIED");
  assert.equal(result.observations[0]!.valueUsd, 5_200_000_000);
  assert.ok(Date.now() - start < 1000);
});

test("a PDF body exceeding its separate window times out and cancels the stream", async () => {
  const { client, wasCancelled } = delayedAttachmentClient(
    { htmlTimeoutMs: 200, attachmentTimeoutMs: 20 },
    60,
  );
  const result = await client();
  assert.equal(result.provider.reasonCode, "ATTACHMENT_BODY_TIMEOUT");
  assert.equal(result.provider.state, "partial");
  assert.equal(result.diagnostics?.stage, "attachment-request");
  assert.equal(result.observations.length, 0);
  assert.equal(wasCancelled(), true);
});

test("an explicit timeoutMs keeps its legacy override across HTML and attachments", async () => {
  const { client } = delayedAttachmentClient(
    { timeoutMs: 20, htmlTimeoutMs: 200, attachmentTimeoutMs: 200 },
    60,
  );
  const result = await client();
  assert.equal(result.provider.reasonCode, "ATTACHMENT_BODY_TIMEOUT");
  assert.equal(result.observations.length, 0);
});

test("an unresponsive stream cancellation has a bounded cleanup deadline", async () => {
  const keepAlive = setTimeout(() => {}, 2000);
  try {
    const { client, wasCancelled } = delayedAttachmentClient({ attachmentTimeoutMs: 20 }, 60, true);
    const start = Date.now();
    const result = await client();
    assert.equal(result.provider.reasonCode, "ATTACHMENT_BODY_TIMEOUT");
    assert.equal(wasCancelled(), true);
    assert.ok(Date.now() - start < 1800);
  } finally {
    clearTimeout(keepAlive);
  }
});

// Test-only generated ReportLab CID document, not ministry observations.
const KOREAN_CID_PDF_FIXTURE_BASE64 =
  "JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUgo+PgplbmRvYmoKMiAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYSAvRW5jb2RpbmcgL1dpbkFuc2lFbmNvZGluZyAvTmFtZSAvRjEgL1N1YnR5cGUgL1R5cGUxIC9UeXBlIC9Gb250Cj4+CmVuZG9iagozIDAgb2JqCjw8Ci9CYXNlRm9udCAvSFlTTXllb25nSm8tTWVkaXVtIC9EZXNjZW5kYW50Rm9udHMgWyA8PAovQmFzZUZvbnQgL0hZU015ZW9uZ0pvLU1lZGl1bSAvQ0lEU3lzdGVtSW5mbyA8PAovT3JkZXJpbmcgKEtvcmVhMSkgL1JlZ2lzdHJ5IChBZG9iZSkgL1N1cHBsZW1lbnQgMQo+PiAvRFcgMTAwMCAvRm9udERlc2NyaXB0b3IgPDwKL0FzY2VudCA3NTIgL0F2Z1dpZHRoIDUwMCAvQ2FwSGVpZ2h0IDczNyAvRGVzY2VudCAtMjcxIC9GbGFncyA2IC9Gb250QkJveCBbIDAgLTE0OCAxMDAxIDg4MCBdIAogIC9Gb250TmFtZSAvSFlTTXllb25nSm8tTWVkaXVtIC9JdGFsaWNBbmdsZSAwIC9MZWFkaW5nIDE0OCAvTWF4V2lkdGggMTAwMCAvTWlzc2luZ1dpZHRoIDUwMCAvU3RlbUggOTEgCiAgL1N0ZW1WIDU4IC9UeXBlIC9Gb250RGVzY3JpcHRvciAvWEhlaWdodCA1NTMKPj4gL1N1YnR5cGUgL0NJREZvbnRUeXBlMiAvVHlwZSAvRm9udCAKICAvVyBbIDEgWyAzMzMgNDE2IF0gMyBbIDQxNiA4MzMgNjI1IDkxNiA4MzMgMjUwIDUwMCBdIDEwIDExIDUwMCAxMiBbIDgzMyAyOTEgODMzIDI5MSAzNzUgNjI1IF0gMTggCiAgMjYgNjI1IDI3IDI4IDMzMyAyOSAzMCA4MzMgMzEgWyA5MTYgNTAwIDEwMDAgNzkxIDcwOCBdIAogIDM2IFsgNzA4IDc1MCA3MDggNjY2IDc1MCA3OTEgMzc1IDUwMCA3OTEgNjY2IAogIDkxNiA3OTEgNzUwIDY2NiA3NTAgNzA4IDY2NiA3OTEgXSA1NCBbIDc5MSA3NTAgMTAwMCA3MDggXSA1OCBbIDcwOCA2NjYgNTAwIDM3NSA1MDAgXSA2MyA2NCA1MDAgNjUgCiAgWyAzMzMgNTQxIDU4MyA1NDEgNTgzIF0gNzAgWyA1ODMgMzc1IDU4MyBdIDczIFsgNTgzIDI5MSAzMzMgNTgzIDI5MSA4NzUgNTgzIF0gODAgODIgNTgzIDgzIFsgNDU4IDU0MSAzNzUgNTgzIF0gCiAgODcgWyA1ODMgODMzIDYyNSBdIDkwIFsgNjI1IDUwMCA1ODMgXSA5MyA5NCA1ODMgOTUgWyA3NTAgXSBdCj4+IF0gL0VuY29kaW5nIC9VbmlLUy1VQ1MyLUggL05hbWUgL0YyIC9TdWJ0eXBlIC9UeXBlMCAvVHlwZSAvRm9udAo+PgplbmRvYmoKNCAwIG9iago8PAovQ29udGVudHMgOCAwIFIgL01lZGlhQm94IFsgMCAwIDU5NS4yNzU2IDg0MS44ODk4IF0gL1BhcmVudCA3IDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago1IDAgb2JqCjw8Ci9QYWdlTW9kZSAvVXNlTm9uZSAvUGFnZXMgNyAwIFIgL1R5cGUgL0NhdGFsb2cKPj4KZW5kb2JqCjYgMCBvYmoKPDwKL0F1dGhvciAoYW5vbnltb3VzKSAvQ3JlYXRpb25EYXRlIChEOjIwMjYxMDIyMDkxMDQ4KzAwJzAwJykgL0NyZWF0b3IgKGFub255bW91cykgL0tleXdvcmRzICgpIC9Nb2REYXRlIChEOjIwMjYxMDIyMDkxMDQ4KzAwJzAwJykgL1Byb2R1Y2VyIChSZXBvcnRMYWIgUERGIExpYnJhcnkgLSBcKG9wZW5zb3VyY2VcKSkgCiAgL1N1YmplY3QgKHVuc3BlY2lmaWVkKSAvVGl0bGUgKHVudGl0bGVkKSAvVHJhcHBlZCAvRmFsc2UKPj4KZW5kb2JqCjcgMCBvYmoKPDwKL0NvdW50IDEgL0tpZHMgWyA0IDAgUiBdIC9UeXBlIC9QYWdlcwo+PgplbmRvYmoKOCAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCAxNzIKPj4Kc3RyZWFtCkdhclcyXSsyXDMkcTlvPmA+c0wxcigoIicsYV1FM0g6KFg1Vz0oMGdUOSVmP1hRI2MvcHRAS1VpcGpuKyJDKUE1KWhTO1BLJDFGN21eUUgwR2hNYEU8WF1VMFlcPj5tRi1aJVk7TDlkY3IsPFBHbHE2Vz9BTWsnZ1MjSXU8TWI9SSxaVippYzRyZ2NOXm1LP21JWWcpVDltZFQiNG1XVj5qSkQpPlM/aygqfj5lbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA5CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDA2MSAwMDAwMCBuIAowMDAwMDAwMTAyIDAwMDAwIG4gCjAwMDAwMDAyMDkgMDAwMDAgbiAKMDAwMDAwMTI0OCAwMDAwMCBuIAowMDAwMDAxNDUxIDAwMDAwIG4gCjAwMDAwMDE1MTkgMDAwMDAgbiAKMDAwMDAwMTc4MCAwMDAwMCBuIAowMDAwMDAxODM5IDAwMDAwIG4gCnRyYWlsZXIKPDwKL0lEIApbPDQzODlkNGY1YzhiNzYxZGNjNzA2NjlmMmI3NDgzZDBjPjw0Mzg5ZDRmNWM4Yjc2MWRjYzcwNjY5ZjJiNzQ4M2QwYz5dCiUgUmVwb3J0TGFiIGdlbmVyYXRlZCBQREYgZG9jdW1lbnQgLS0gZGlnZXN0IChvcGVuc291cmNlKQoKL0luZm8gNiAwIFIKL1Jvb3QgNSAwIFIKL1NpemUgOQo+PgpzdGFydHhyZWYKMjEwMQolJUVPRgo=";

test("the actual decoder resolves Korean CID text with trusted local CMaps and no network fetch", async () => {
  const resources = resolveMotiePdfAssets();
  assert.equal(/^https?:/i.test(resources.cMapUrl), false);
  assert.equal(/^https?:/i.test(resources.standardFontDataUrl), false);
  const beforeFetch = globalThis.fetch;
  let remoteCalls = 0;
  globalThis.fetch = async () => {
    remoteCalls++;
    throw new Error("PDF resource network fetch is prohibited");
  };
  try {
    const bytes = new Uint8Array(Buffer.from(KOREAN_CID_PDF_FIXTURE_BASE64, "base64"));
    const text = await extractMotiePdfText(bytes, AbortSignal.timeout(7000));
    assert.ok(
      text.includes("한글 문서 해석 검증용"),
      "Korean CID text must not silently disappear",
    );
    assert.equal(remoteCalls, 0);
  } finally {
    globalThis.fetch = beforeFetch;
  }
});
