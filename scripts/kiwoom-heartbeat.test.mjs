import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";

const run = options => spawnSync(process.execPath, ["--experimental-strip-types", "--disable-warning=ExperimentalWarning",
  "scripts/kiwoom-cli.mjs", ...options], {
  cwd: new URL("../", import.meta.url), encoding: "utf8", timeout: 20_000,
  env: { ...process.env, DATABASE_URL: "", KIWOOM_APP_KEY: "", KIWOOM_APP_SECRET: "",
    KIWOOM_FLOW_ENABLED: "false", KIWOOM_ENV: "real", KIWOOM_FLOW_MODE: "collector",
    KIWOOM_EXPECTED_EGRESS_IP: "", KIWOOM_DATA_SCOPE_ID: "fixture-heartbeat-cli" },
});
const instance = "11111111-1111-4111-8111-111111111111";
test("DB-only heartbeat reaches DATABASE_MISSING without credentials/live flag or an egress/broker gate", () => {
  const result = run(["heartbeat", "--event", "start", "--instance-id", instance]);
  assert.equal(result.status, 1);
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, "DATABASE_MISSING");
  for (const privateField of [instance, "fixture-heartbeat-cli", "appkey", "secretkey", "Bearer"])
    assert.equal(result.stdout.includes(privateField), false);
});
test("heartbeat rejects arbitrary error text and malformed instance without echoing them", () => {
  for (const options of [
    ["heartbeat", "--event", "error", "--instance-id", instance, "--error-code", "fixture-unsafe-private-error"],
    ["heartbeat", "--event", "start", "--instance-id", "fixture-private-id"],
    ["heartbeat", "--event", "start", "--instance-id", instance, "--live"],
    ["doctor", "--event", "start", "--instance-id", instance],
  ]) {
    const result = run(options);
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stdout).status, "CONFIGURATION_FAILED");
    for (const value of ["fixture-unsafe-private-error", "fixture-private-id", instance])
      assert.equal(result.stdout.includes(value), false);
  }
});
