import assert from "node:assert/strict";
import { test } from "node:test";
import { registerAdapter, runSources } from "./runner.ts";

test("AT-14: fan-out returns within the budget with partial=true when a source times out", async () => {
  registerAdapter("hankyung-finance", async () => {
    await new Promise((r) => setTimeout(r, 5_000));
    return { items: [] };
  });
  registerAdapter("hankyung-economy", async () => ({ items: [] }));
  const started = Date.now();
  const { results, partial } = await runSources(["hankyung-finance", "hankyung-economy", "yonhap-market"], { budgetMs: 600, perSourceMs: 500 });
  const took = Date.now() - started;
  assert.ok(took < 1_500, `took ${took}ms`);
  assert.equal(partial, true);
  const byId = Object.fromEntries(results.map((r) => [r.id, r.state]));
  assert.equal(byId["hankyung-finance"], "timeout");
  assert.equal(byId["hankyung-economy"], "empty");
  assert.equal(byId["yonhap-market"], "disabled", "candidate sources never run");
});
