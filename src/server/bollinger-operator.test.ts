import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { authorizeBollingerCollection, handleBollingerOperator } from "./bollinger-operator.ts";

const SECRET = "QA_SYNTHETIC_OPERATOR_NOT_REAL_1234567890";
const env = { CRON_SECRET: SECRET, NODE_ENV: "production", VERCEL: "1" };
const origin = "https://personal.example";
const operatorUrl = `${origin}/api/bollinger/operator`;
const collectUrl = `${origin}/api/bollinger/collect`;
function request(method = "POST", options: { url?: string; body?: unknown; headers?: Record<string, string>; raw?: string } = {}): Request {
  return new Request(options.url ?? operatorUrl, { method, headers: {
    ...(method !== "GET" ? { origin, "content-type": "application/json", "sec-fetch-site": "same-origin" } : {}), ...options.headers,
  }, ...(method === "POST" ? { body: options.raw ?? JSON.stringify(Object.hasOwn(options, "body") ? options.body : { secret: SECRET }) } : {}) });
}
async function unlock(): Promise<string> {
  const response = await handleBollingerOperator(request(), env);
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie")!.split(";")[0]!;
}
function signed(payload: unknown): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const key = createHmac("sha256", SECRET).update("bollinger:operator:key:v1").digest();
  const signature = createHmac("sha256", key).update("bollinger:operator:session:v1\0").update(encoded).digest("base64url");
  return `__Host-bollinger-operator=${encoded}.${signature}`;
}

test("unlock issues only an expiring origin-bound HttpOnly operator cookie and safe status", async () => {
  const anonymous = await handleBollingerOperator(request("GET"), env);
  assert.deepEqual(await anonymous.json(), { status: "OPERATOR_AUTH_REQUIRED", authorized: false });
  const response = await handleBollingerOperator(request(), env);
  assert.deepEqual(await response.clone().json(), { status: "OPERATOR_AUTHORIZED", authorized: true });
  assert.equal(response.headers.get("cache-control"), "no-store");
  const header = response.headers.get("set-cookie")!;
  assert.match(header, /^__Host-bollinger-operator=/);
  for (const attribute of ["Path=/", "HttpOnly", "Secure", "SameSite=Strict", "Max-Age=1800"]) assert.ok(header.includes(attribute));
  assert.doesNotMatch(header, /Domain=/i);
  assert.ok(!header.includes(SECRET));
  assert.ok(!(await response.text()).includes(SECRET));
  const cookie = header.split(";")[0]!;
  const status = await handleBollingerOperator(request("GET", { headers: { cookie } }), env);
  assert.deepEqual(await status.json(), { status: "OPERATOR_AUTHORIZED", authorized: true });
  assert.equal(await authorizeBollingerCollection(request("POST", { url: collectUrl, body: {}, headers: { cookie } }), env), null);
});

test("missing or invalid server secrets fail closed without raw values", async () => {
  for (const environment of [{}, { CRON_SECRET: "short" }, { CRON_SECRET: ` ${SECRET}` }]) {
    const response = await handleBollingerOperator(request(), environment);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.ok(!(await response.text()).includes(SECRET));
    assert.equal((await authorizeBollingerCollection(request("POST", { url: collectUrl }), environment))?.status, 503);
  }
  const wrong = await handleBollingerOperator(request("POST", { body: { secret: "incorrect" } }), env);
  assert.equal(wrong.status, 401);
  assert.deepEqual(await wrong.json(), { status: "OPERATOR_AUTH_REQUIRED", authorized: false });
  assert.equal(wrong.headers.get("set-cookie"), null);
});

test("mutating operator and collection requests require exact Origin and reject sibling/cross-site requests", async () => {
  const cookie = await unlock();
  const invalidHeaders: Record<string, string>[] = [
    { origin: "https://sibling.example" }, { origin: "null" }, { origin: "https://personal.example/" },
    { "sec-fetch-site": "same-site" }, { "sec-fetch-site": "cross-site" }, { "sec-fetch-site": "none" },
  ];
  for (const headers of invalidHeaders) {
    assert.equal((await handleBollingerOperator(request("POST", { headers }), env)).status, 403);
    assert.equal((await handleBollingerOperator(request("DELETE", { headers }), env)).status, 403);
    assert.equal((await authorizeBollingerCollection(request("POST", { url: collectUrl, headers: { cookie, ...headers } }), env))?.status, 403);
  }
  const noOrigin = request(); noOrigin.headers.delete("origin");
  assert.equal((await handleBollingerOperator(noOrigin, env)).status, 403);
  assert.equal((await handleBollingerOperator(request("GET", { headers: { "sec-fetch-site": "cross-site" } }), env)).status, 403);
});

test("anonymous collection, unsupported methods, URL secrets and form submits are rejected", async () => {
  assert.equal((await authorizeBollingerCollection(request("POST", { url: collectUrl }), env))?.status, 401);
  assert.equal((await authorizeBollingerCollection(request("GET", { url: collectUrl }), env))?.status, 405);
  assert.equal((await handleBollingerOperator(request("PUT"), env)).status, 405);
  assert.equal((await handleBollingerOperator(request("POST", { url: `${operatorUrl}?secret=${SECRET}` }), env)).status, 400);
  assert.equal((await handleBollingerOperator(request("POST", { headers: { "content-type": "application/x-www-form-urlencoded" } }), env)).status, 415);
  assert.equal((await authorizeBollingerCollection(request("POST", { url: collectUrl, headers: { "content-type": "text/plain" } }), env))?.status, 415);
});

test("unlock body is bounded by actual streamed bytes and only accepts the explicit secret role", async () => {
  for (const options of [
    { raw: "{" }, { body: null }, { body: [SECRET] }, { body: { password: SECRET } },
    { body: { secret: SECRET, owner: "dev-user" } }, { body: { secret: "x".repeat(257) } },
    { raw: JSON.stringify({ secret: SECRET, padding: "x".repeat(2048) }) },
    { headers: { "content-length": "2049" } }, { headers: { "content-length": "not-a-number" } },
  ]) {
    const response = await handleBollingerOperator(request("POST", options), env);
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.ok(!(await response.text()).includes(SECRET));
  }
});

test("malformed unlock data and URL input are not reflected in safe error responses", async () => {
  const privateNote = "QA_PRIVATE_CLIENT_INPUT_NOT_TO_ECHO";
  const malformed = await handleBollingerOperator(request("POST", { body: { secret: SECRET, privateNote } }), env);
  assert.equal(malformed.status, 400);
  const body = await malformed.text();
  assert.ok(!body.includes(SECRET)); assert.ok(!body.includes(privateNote));
  assert.deepEqual(JSON.parse(body), { status: "INVALID_BODY", authorized: false });
  const query = await handleBollingerOperator(request("POST", { url: `${operatorUrl}?secret=${SECRET}&note=${privateNote}` }), env);
  assert.deepEqual(await query.json(), { status: "QUERY_NOT_ALLOWED" });
});

test("forged, malformed, duplicate and secret-rotated cookies fail closed", async () => {
  const cookie = await unlock();
  for (const invalid of [cookie.slice(0, -1) + (cookie.endsWith("A") ? "B" : "A"), "__Host-bollinger-operator=not-signed", `${cookie}; ${cookie}`, `__Host-bollinger-operator=${"x".repeat(1100)}`]) {
    assert.equal((await authorizeBollingerCollection(request("POST", { url: collectUrl, headers: { cookie: invalid } }), env))?.status, 401);
  }
  assert.equal((await authorizeBollingerCollection(request("POST", { url: collectUrl, headers: { cookie } }), { ...env, CRON_SECRET: `${SECRET}_rotated` }))?.status, 401);
  const otherOrigin = "https://other.example";
  assert.equal((await authorizeBollingerCollection(request("POST", { url: `${otherOrigin}/api/bollinger/collect`, headers: { origin: otherOrigin, cookie } }), env))?.status, 401);
});

test("signed sessions validate expiry, issue time, scope, duration and nonce", async () => {
  const now = Math.floor(Date.now() / 1000);
  const payload = { v: 1, scope: "bollinger-collect", origin, iat: now - 1, exp: now + 1799, nonce: "A".repeat(22) };
  assert.equal(await authorizeBollingerCollection(request("POST", { url: collectUrl, headers: { cookie: signed(payload) } }), env), null);
  for (const patch of [
    { iat: now - 1800, exp: now }, { iat: now + 10, exp: now + 1810 }, { scope: "kiwoom-owner" },
    { exp: now + 3600 }, { nonce: "short" }, { v: 2 }, { iat: String(now - 1) }, { unexpected: true },
  ]) {
    assert.equal((await authorizeBollingerCollection(request("POST", { url: collectUrl, headers: { cookie: signed({ ...payload, ...patch }) } }), env))?.status, 401);
  }
});

test("logout removes the cookie even if operator settings have been removed", async () => {
  const response = await handleBollingerOperator(request("DELETE"), {});
  assert.deepEqual(await response.json(), { status: "OPERATOR_SIGNED_OUT", authorized: false });
  const header = response.headers.get("set-cookie")!;
  assert.match(header, /^__Host-bollinger-operator=;/);
  assert.match(header, /Max-Age=0/);
  assert.match(header, /HttpOnly; Secure; SameSite=Strict/);
});

test("production unlock rejects plaintext origins and local development retains secure-cookie flags", async () => {
  const local = "http://localhost:8080";
  const req = () => request("POST", { url: `${local}/api/bollinger/operator`, headers: { origin: local } });
  assert.equal((await handleBollingerOperator(req(), env)).status, 403);
  const dev = await handleBollingerOperator(req(), { CRON_SECRET: SECRET, NODE_ENV: "development" });
  assert.equal(dev.status, 200); assert.match(dev.headers.get("set-cookie")!, /Secure/);
  const other = "http://untrusted.example";
  assert.equal((await handleBollingerOperator(request("POST", { url: `${other}/api/bollinger/operator`, headers: { origin: other } }), { CRON_SECRET: SECRET })).status, 403);
});

test("operator module has no database/provider/broker/client-auth imports or logging", async () => {
  const source = await readFile(new URL("./bollinger-operator.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /(?:import|require)\([^)]*(?:db|provider|kiwoom|auth\/)/);
  assert.doesNotMatch(source, /from\s+["'][^"']*(?:\/db|provider|kiwoom|auth\/)/);
  assert.doesNotMatch(source, /console\.(?:log|error|warn|info|debug)/);
});
