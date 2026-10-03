import assert from "node:assert/strict";
import { test } from "node:test";
import { openOriginalWithResolver, type OpenerHost, type PopupLike } from "./open-original.ts";

function fakeHost(blocked = false) {
  const calls: { url: string; at: number }[] = [];
  const popup: PopupLike & { replaced: string | null } = {
    opener: {},
    replaced: null,
    location: { replace(url: string) { popup.replaced = url; } },
    document: { title: "", body: { textContent: "" } },
  };
  const host: OpenerHost = {
    open(url) {
      calls.push({ url, at: calls.length });
      return blocked ? null : popup;
    },
  };
  return { host, calls, popup };
}

test("D2: window.open runs synchronously before the resolver settles", async () => {
  const { host, calls, popup } = fakeHost();
  let resolveUrl!: (u: string) => void;
  const pending = openOriginalWithResolver(() => new Promise<string>((r) => (resolveUrl = r)), {
    fallbackUrl: "https://finance.naver.com/research/",
    host,
  });
  assert.equal(calls.length, 1, "opened inside the click tick");
  assert.equal(calls[0]!.url, "about:blank");
  resolveUrl("https://stock.pstatic.net/stock-research/company/1/x.pdf");
  const out = await pending;
  assert.deepEqual(out, { opened: true, url: "https://stock.pstatic.net/stock-research/company/1/x.pdf" });
  assert.equal(popup.opener, null);
  assert.equal(popup.replaced, "https://stock.pstatic.net/stock-research/company/1/x.pdf");
});

test("D2: resolution failure falls back to the research page", async () => {
  const { host, popup } = fakeHost();
  const out = await openOriginalWithResolver(async () => {
    throw new Error("network");
  }, { fallbackUrl: "https://finance.naver.com/research/company_read.naver?nid=1", host });
  assert.equal(out.opened, true);
  assert.equal(popup.replaced, "https://finance.naver.com/research/company_read.naver?nid=1");
});

test("D2: a blocked popup hands the resolved link to onBlocked (toast)", async () => {
  const { host } = fakeHost(true);
  let toastUrl: string | null = null;
  const out = await openOriginalWithResolver(async () => "https://example.com/a.pdf", {
    fallbackUrl: "https://example.com/page",
    host,
    onBlocked: (u) => (toastUrl = u),
  });
  assert.equal(out.opened, false);
  assert.equal(toastUrl, "https://example.com/a.pdf");
});
