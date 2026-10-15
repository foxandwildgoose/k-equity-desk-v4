import test from "node:test";
import assert from "node:assert/strict";
import { KisRealtimeHub } from "./kis-realtime.ts";

test("failed provider approval removes every pending listener instead of leaking subscriptions", async () => {
  const originalFetch = globalThis.fetch;
  const key = process.env.KIS_APP_KEY;
  const secret = process.env.KIS_APP_SECRET;
  process.env.KIS_APP_KEY = "test-only-not-a-provider-credential";
  process.env.KIS_APP_SECRET = "test-only-not-a-provider-credential";
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });
  try {
    const hub = new KisRealtimeHub();
    await assert.rejects(
      hub.subscribe("005930", () => {}),
      /KIS approval HTTP 503/,
    );
    assert.equal((Reflect.get(hub, "listeners") as Map<string, unknown>).size, 0);
    assert.equal(hub.getStatus().connected, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (key === undefined) delete process.env.KIS_APP_KEY;
    else process.env.KIS_APP_KEY = key;
    if (secret === undefined) delete process.env.KIS_APP_SECRET;
    else process.env.KIS_APP_SECRET = secret;
  }
});
