import assert from "node:assert/strict";
import test from "node:test";
import {
  clientErrorMessage,
  installClientRecovery,
  isClientChunkFailure,
  tryAutomaticChunkRecovery,
  type ClientRecoveryHost,
} from "./client-recovery.ts";

const chunkError = new TypeError("Failed to fetch dynamically imported module: https://example.test/assets/page-old.js");

function fixture(pathname = "/", saved = new Map<string, string>()) {
  let reloads = 0;
  const host: ClientRecoveryHost = {
    sessionStorage: {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => { saved.set(key, value); },
    },
    location: { pathname, reload() { reloads++; } },
  };
  return { host, saved, reloads: () => reloads };
}

test("recognizes browser chunk/preload failures without treating API or offline errors as chunks", () => {
  for (const error of [
    chunkError,
    new TypeError("Importing a module script failed."),
    new TypeError("error loading dynamically imported module: https://example.test/a.js"),
    new Error("Unable to preload CSS for /assets/a.css"),
    { name: "ChunkLoadError", message: "Loading chunk 12 failed." },
    "Loading CSS chunk 23 failed.",
  ]) assert.equal(isClientChunkFailure(error), true, clientErrorMessage(error));
  for (const error of [
    new TypeError("Failed to fetch"),
    new TypeError("Load failed"),
    new Error("NetworkError when attempting to fetch resource."),
    new Error("HTTP 503 from market API"),
    new Error("Unexpected token '<'"),
    null,
    { message: 123 },
  ]) assert.equal(isClientChunkFailure(error), false);
});

test("ordinary API failure never writes a recovery marker or reloads", () => {
  const f = fixture();
  assert.equal(tryAutomaticChunkRecovery(new TypeError("Failed to fetch"), f.host), false);
  assert.equal(f.reloads(), 0);
  assert.equal(f.saved.size, 0);
});

test("the marker survives a new document, bounds reloads to one per path and does not suppress another path", () => {
  const first = fixture("/etfs/0246X0");
  assert.equal(tryAutomaticChunkRecovery(chunkError, first.host), true);
  assert.equal(tryAutomaticChunkRecovery(chunkError, first.host), false);
  assert.equal(first.reloads(), 1);
  const nextDocument = fixture("/etfs/0246X0", first.saved);
  assert.equal(tryAutomaticChunkRecovery(chunkError, nextDocument.host), false);
  assert.equal(nextDocument.reloads(), 0);
  const otherPath = fixture("/export-desk", first.saved);
  assert.equal(tryAutomaticChunkRecovery(chunkError, otherPath.host), true);
  assert.equal(otherPath.reloads(), 1);
});

test("blocked or silently discarded sessionStorage never causes automatic reload loops", () => {
  for (const failure of ["getter", "read", "write", "discard"] as const) {
    const f = fixture();
    if (failure === "getter") {
      Object.defineProperty(f.host, "sessionStorage", { get() { throw new Error("SecurityError"); } });
    } else if (failure === "read") {
      f.host.sessionStorage.getItem = () => { throw new Error("SecurityError"); };
    } else if (failure === "write") {
      f.host.sessionStorage.setItem = () => { throw new Error("QuotaExceededError"); };
    } else {
      f.host.sessionStorage.setItem = () => {};
    }
    assert.equal(tryAutomaticChunkRecovery(chunkError, f.host), false, failure);
    assert.equal(tryAutomaticChunkRecovery(chunkError, f.host), false, failure);
    assert.equal(f.reloads(), 0, failure);
  }
});

test("a failed reload retains its marker and malformed thrown values remain safe", () => {
  const f = fixture();
  f.host.location.reload = () => { throw new Error("Navigation blocked"); };
  assert.equal(tryAutomaticChunkRecovery(chunkError, f.host), false);
  assert.equal(f.saved.size, 1);
  assert.equal(tryAutomaticChunkRecovery(chunkError, f.host), false);
  const malformed = Object.defineProperty({}, "message", { get() { throw new Error("bad getter"); } });
  assert.equal(clientErrorMessage(malformed), "알 수 없는 오류가 발생했습니다.");
  assert.equal(isClientChunkFailure(malformed), false);
  assert.equal(clientErrorMessage({ message: "서버에서 전달된 오류" }), "서버에서 전달된 오류");
});

test("client installation is idempotent, SSR-safe and only suppresses a recovered preload error", () => {
  assert.doesNotThrow(() => installClientRecovery());
  const f = fixture();
  const events = new EventTarget();
  Object.assign(events, f.host);
  const host = events as unknown as Window;
  installClientRecovery(host);
  installClientRecovery(host);
  const event = new Event("vite:preloadError", { cancelable: true });
  Object.defineProperty(event, "payload", { value: chunkError });
  host.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(f.reloads(), 1);
  const repeated = new Event("vite:preloadError", { cancelable: true });
  Object.defineProperty(repeated, "payload", { value: chunkError });
  host.dispatchEvent(repeated);
  assert.equal(repeated.defaultPrevented, false);
  assert.equal(f.reloads(), 1);
});
