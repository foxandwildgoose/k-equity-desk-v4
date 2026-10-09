import assert from "node:assert/strict";
import test from "node:test";
import { handleSelectedBollingerCollection } from "./bollinger-collection-handler.ts";
import { handleBollingerOperator } from "./bollinger-operator.ts";

const secret = "QA_ONLY_BOLLINGER_OPERATOR_SECRET_123456789";
const env = { CRON_SECRET: secret, BOLLINGER_CLOUD_ENABLED: "true", VERCEL_ENV: "production" };
const input = { universeId: "QA-IMMUTABLE-KOSPI", configVersion: "long-daily-2.0.0", selection: { top: 100, minWeight: 0, sectors: [] } };
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
