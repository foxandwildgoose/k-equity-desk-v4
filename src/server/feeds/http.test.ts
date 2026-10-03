import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchWithPolicy, FetchPolicyError, isAllowedUrl, __setFetchImpl, ALLOWED_HOSTS } from "./http.ts";
import { healthOf, isCircuitOpen, resetHealth } from "./health.ts";

test("AT-05: rejects non-https and hosts outside the registry allowlist", async () => {
  assert.equal(isAllowedUrl("http://www.hankyung.com/feed/finance").ok, false);
  assert.equal(isAllowedUrl("https://evil.example.com/x").ok, false);
  assert.equal(isAllowedUrl("https://169.254.169.254/latest/meta-data").ok, false);
  assert.equal(isAllowedUrl("https://www.hankyung.com/feed/finance").ok, true);
  assert.ok(ALLOWED_HOSTS.has("stock.naver.com"));
  await assert.rejects(
    fetchWithPolicy("http://www.hankyung.com/feed/finance", { sourceId: "hankyung-finance" }),
    (e: unknown) => e instanceof FetchPolicyError && e.code === "non-https",
  );
  await assert.rejects(
    fetchWithPolicy("https://evil.example.com/rss", { sourceId: "hankyung-finance" }),
    (e: unknown) => e instanceof FetchPolicyError && e.code === "host-not-allowed",
  );
});

test("AT-05: redirects to non-allowlisted hosts are refused", async () => {
  resetHealth();
  __setFetchImpl(async () => new Response(null, { status: 302, headers: { location: "https://evil.example.com/x" } }));
  try {
    await assert.rejects(
      fetchWithPolicy("https://www.hankyung.com/feed/economy", { sourceId: "hankyung-economy", bypassCache: true }),
      (e: unknown) => e instanceof FetchPolicyError && e.code === "host-not-allowed",
    );
  } finally {
    __setFetchImpl(null);
  }
});

test("AT-05: a 429 opens the source circuit; later calls are refused", async () => {
  resetHealth();
  let calls = 0;
  __setFetchImpl(async () => {
    calls++;
    return new Response("slow down", { status: 429 });
  });
  try {
    const res = await fetchWithPolicy("https://www.hankyung.com/feed/it", { sourceId: "hankyung-it", bypassCache: true });
    assert.equal(res.status, 429);
    assert.equal(isCircuitOpen("hankyung-it"), true);
    assert.equal(healthOf("hankyung-it").circuit, "open");
    await assert.rejects(
      fetchWithPolicy("https://www.hankyung.com/feed/it", { sourceId: "hankyung-it", bypassCache: true }),
      (e: unknown) => e instanceof FetchPolicyError && e.code === "circuit-open",
    );
    assert.equal(calls, 1);
  } finally {
    __setFetchImpl(null);
  }
});

test("fetchWithPolicy caches by URL, dedupes in flight, retries once on 5xx", async () => {
  resetHealth();
  let calls = 0;
  __setFetchImpl(async () => {
    calls++;
    if (calls === 1) return new Response("oops", { status: 503 });
    return new Response("<rss><channel></channel></rss>", { status: 200, headers: { "content-type": "application/rss+xml; charset=utf-8" } });
  });
  try {
    const [a, b] = await Promise.all([
      fetchWithPolicy("https://www.hankyung.com/feed/international", { sourceId: "hankyung-international" }),
      fetchWithPolicy("https://www.hankyung.com/feed/international", { sourceId: "hankyung-international" }),
    ]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(calls, 2, "one 503 + one retry, shared by both callers");
    const c = await fetchWithPolicy("https://www.hankyung.com/feed/international", { sourceId: "hankyung-international" });
    assert.equal(c.fromCache, true);
    assert.equal(calls, 2);
  } finally {
    __setFetchImpl(null);
  }
});

test("disabled candidates and env-gated sources never hit the network", async () => {
  __setFetchImpl(async () => {
    throw new Error("network must not be called");
  });
  try {
    await assert.rejects(
      fetchWithPolicy("https://www.yna.co.kr/rss/market.xml", { sourceId: "yonhap-market" }),
      (e: unknown) => e instanceof FetchPolicyError && e.code === "source-disabled",
    );
    const prev = process.env.NEWS_BLOOMBERG_ENABLED;
    process.env.NEWS_BLOOMBERG_ENABLED = "false";
    await assert.rejects(
      fetchWithPolicy("https://feeds.bloomberg.com/markets/news.rss", { sourceId: "bloomberg-markets" }),
      (e: unknown) => e instanceof FetchPolicyError && e.code === "source-disabled",
    );
    if (prev === undefined) delete process.env.NEWS_BLOOMBERG_ENABLED;
    else process.env.NEWS_BLOOMBERG_ENABLED = prev;
  } finally {
    __setFetchImpl(null);
  }
});
