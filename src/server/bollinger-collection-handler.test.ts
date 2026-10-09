import assert from "node:assert/strict";
import test from "node:test";
import { handleSelectedBollingerCollection } from "./bollinger-collection-handler.ts";
import { handleBollingerOperator } from "./bollinger-operator.ts";

const secret = "QA_ONLY_BOLLINGER_OPERATOR_SECRET_123456789";
const env = { CRON_SECRET: secret, BOLLINGER_CLOUD_ENABLED: "true", VERCEL_ENV: "production" };
const input = { universeId: "QA-IMMUTABLE-KOSPI", configVersion: "long-daily-2.0.0", selection: { top: 100, minWeight: 0, sectors: [] } };
const bootstrap = { bootstrapTarget: "KOSDAQ", configVersion: "long-daily-2.0.0", selection: { top: 100, minWeight: 0, sectors: [] } };
const origin = "https://personal.example";
function request(body: unknown, cookie = "", headers: Record<string, string> = {}) {
  return new Request(`${origin}/api/bollinger/collect`, { method: "POST", headers: {
    origin, "content-type": "application/json", cookie, "sec-fetch-site": "same-origin", ...headers,
  }, body: JSON.stringify(body) });
}
async function session() {
  const response = await handleBollingerOperator(new Request(`${origin}/api/bollinger/operator`, {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ secret }),
  }), env);
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie")!.split(";")[0]!;
}

test("browser collection refuses unauthenticated and cross-origin requests before any runtime callback", async () => {
  let calls = 0; const run = async () => { calls++; return {}; };
  assert.equal((await handleSelectedBollingerCollection(request(input), run, env)).status, 401);
  const cookie = await session();
  assert.equal((await handleSelectedBollingerCollection(request(input, cookie, { origin: "https://sibling.example" }), run, env)).status, 403);
  assert.equal((await handleSelectedBollingerCollection(request(input, cookie, { "sec-fetch-site": "same-site" }), run, env)).status, 403);
  assert.equal(calls, 0);
});

test("explicit browser choices are delivered exactly and cannot change runtime budget, URLs or credentials", async () => {
  const cookie = await session(); let calls = 0;
  const response = await handleSelectedBollingerCollection(request(input, cookie), async (config, choices) => {
    calls++; assert.deepEqual(choices, input); assert.equal(config.budgetSeconds, 180);
    assert.equal(config.top, 20); return { status: "PARTIAL_BUDGET", jobs: [] };
  }, env);
  assert.equal(response.status, 200); assert.equal((await response.json()).status, "PARTIAL_BUDGET"); assert.equal(calls, 1);
  for (const invalid of [
    { ...input, budgetSeconds: 999999 }, { ...input, url: "https://untrusted.example" },
    { ...input, secret }, { ...input, selection: { ...input.selection, top: 999 } },
    { ...input, selection: { ...input.selection, minWeight: -1 } }, { ...input, symbols: ["../../secret"] },
  ]) {
    const rejected = await handleSelectedBollingerCollection(request(invalid, cookie), async () => { calls++; return {}; }, env);
    assert.equal(rejected.status, 400); assert.doesNotMatch(await rejected.text(), new RegExp(secret));
  }
  assert.equal(calls, 1);
});

test("disabled, preview and malformed requests cannot run an operational collection", async () => {
  const cookie = await session(); let calls = 0; const run = async () => { calls++; return {}; };
  assert.equal((await handleSelectedBollingerCollection(request(input, cookie), run, { ...env, BOLLINGER_CLOUD_ENABLED: "false" })).status, 409);
  assert.equal((await handleSelectedBollingerCollection(request(input, cookie), run, { ...env, VERCEL_ENV: "preview" })).status, 409);
  assert.equal((await handleSelectedBollingerCollection(request(input, cookie, { "content-length": "65537" }), run, env)).status, 413);
  assert.equal((await handleSelectedBollingerCollection(request({ ...input, text: "x".repeat(65537) }, cookie), run, env)).status, 413);
  assert.equal(calls, 0);
});

test("provider and database failures return safe allowlisted statuses without raw text", async () => {
  const cookie = await session();
  const db = await handleSelectedBollingerCollection(request(input, cookie), async () => { throw new Error("DATABASE_MISSING"); }, env);
  assert.equal(db.status, 503); assert.equal((await db.json()).status, "DATABASE_MISSING");
  const unknown = await handleSelectedBollingerCollection(request(input, cookie), async () => { throw new Error(`private ${secret}`); }, env);
  assert.equal(unknown.status, 503); assert.deepEqual(await unknown.json(), { status: "COLLECTION_FAILED" });
});

test("first acquisition requires operator authorization before reading body or entering runtime", async () => {
  let calls = 0, bodyReads = 0;
  const run = async () => { calls++; return {}; };
  const anonymous = request(bootstrap);
  Object.defineProperty(anonymous, "body", { get() { bodyReads++; throw new Error("QA private unread body"); } });
  const rejected = await handleSelectedBollingerCollection(anonymous, run, env);
  assert.equal(rejected.status, 401); assert.equal(calls, 0); assert.equal(bodyReads, 0);
  const cookie = await session();
  assert.equal((await handleSelectedBollingerCollection(request(bootstrap, cookie, { origin: "https://other.example" }), run, env)).status, 403);
  const noOrigin = request(bootstrap, cookie); noOrigin.headers.delete("origin");
  assert.equal((await handleSelectedBollingerCollection(noOrigin, run, env)).status, 403);
  assert.equal(calls, 0);
});

test("authorized bootstrap preserves exact market choices without requiring or fabricating a saved snapshot", async () => {
  const cookie = await session(); let calls = 0;
  for (const target of ["KOSPI", "KOSDAQ", "NASDAQ_LISTED", "ETF:069500", "ETF:0233A0"]) {
    const choices = { ...bootstrap, bootstrapTarget: target, selection: { top: 20, minWeight: 0, sectors: ["Technology"] }, symbols: ["KR:005930"] };
    const response = await handleSelectedBollingerCollection(request(choices, cookie), async (config, received) => {
      calls++; assert.deepEqual(received, choices); assert.equal("universeId" in received, false);
      assert.equal(config.budgetSeconds, 180); assert.deepEqual(config.targets, ["KOSPI"]);
      return { status: "PARTIAL_BUDGET", jobs: [] };
    }, env);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "PARTIAL_BUDGET", jobs: [] });
  }
  assert.equal(calls, 5);
});

test("bootstrap rejects mixed requests, unsupported membership and unsafe provider settings before runtime", async () => {
  const cookie = await session(); let calls = 0;
  for (const invalid of [
    { ...bootstrap, universeId: input.universeId }, { ...input, bootstrapTarget: "KOSDAQ" },
    { ...bootstrap, bootstrapTarget: "SP500" }, { ...bootstrap, bootstrapTarget: "NASDAQ100" },
    { ...bootstrap, bootstrapTarget: "https://untrusted.example" }, { ...bootstrap, bootstrapTarget: "ETF:../../secret" },
    { ...bootstrap, budgetSeconds: 999999 }, { ...bootstrap, url: "https://untrusted.example" },
    { ...bootstrap, appKey: secret }, { ...bootstrap, secret }, { ...bootstrap, symbols: ["../../secret"] },
    { ...bootstrap, selection: { ...bootstrap.selection, top: 999 } },
    { ...bootstrap, selection: { ...bootstrap.selection, providerUrl: "https://untrusted.example" } },
  ]) {
    const response = await handleSelectedBollingerCollection(request(invalid, cookie), async () => { calls++; return {}; }, env);
    assert.equal(response.status, 400); assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { status: "SELECTION_INVALID" });
  }
  assert.equal(calls, 0);
});

test("empty explicit intersections avoid membership acquisition for saved and first-acquisition requests", async () => {
  const cookie = await session(); let calls = 0;
  for (const choices of [input, bootstrap]) {
    const response = await handleSelectedBollingerCollection(request({ ...choices, symbols: [] }, cookie), async () => { calls++; return {}; }, env);
    assert.equal(response.status, 400); assert.deepEqual(await response.json(), { status: "NO_SELECTION" });
  }
  assert.equal(calls, 0);
});

test("first-acquisition runtime validation returns only safe actionable codes", async () => {
  const cookie = await session();
  for (const status of ["BOOTSTRAP_TARGET_INVALID", "UNIVERSE_UNSUPPORTED", "NO_SELECTION", "CONFIGURATION_VERSION_INVALID"]) {
    const response = await handleSelectedBollingerCollection(request(bootstrap, cookie), async () => { throw new Error(status); }, env);
    assert.equal(response.status, 400); assert.deepEqual(await response.json(), { status });
  }
  const unknown = await handleSelectedBollingerCollection(request(bootstrap, cookie), async () => { throw new Error(`QA private ${secret}`); }, env);
  assert.equal(unknown.status, 503); assert.deepEqual(await unknown.json(), { status: "COLLECTION_FAILED" });
});
