import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
function run(args, overrides = {}) {
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (key.startsWith("KIWOOM_") || key === "DATABASE_URL") delete env[key];
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--disable-warning=ExperimentalWarning",
      "scripts/kiwoom-cli.mjs",
      ...args,
    ],
    { encoding: "utf8", env: { ...env, ...overrides }, timeout: 5000 },
  );
  for (const secret of ["fixture-cli-key", "fixture-cli-secret"])
    assert.equal((result.stdout + result.stderr).includes(secret), false);
  return result;
}
test("CLI configuration check distinguishes four runtime states without connecting to even an invalid DB", () => {
  for (const [variables, status] of [
    [{}, "CREDENTIALS_NOT_CONFIGURED"],
    [{ KIWOOM_APP_KEY: "fixture-cli-key" }, "APP_SECRET_MISSING"],
    [{ KIWOOM_APP_SECRET: "fixture-cli-secret" }, "APP_KEY_MISSING"],
    [
      { KIWOOM_APP_KEY: "fixture-cli-key", KIWOOM_APP_SECRET: "fixture-cli-secret" },
      "CREDENTIALS_CONFIGURED",
    ],
  ]) {
    const result = run(["verify", "--check-config"], {
      ...variables,
      DATABASE_URL: "postgresql://invalid.test/never-connect",
    });
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.credentialsStatus, status);
    assert.equal(parsed.authentication, "NOT_TESTED");
    assert.equal(parsed.egress, "NOT_CHECKED");
  }
});
test("CLI sync rejects implicit live calls before IP check/auth/DB work", () => {
  const result = run(["sync", "--code", "005930", "--from", "2026-09-01", "--to", "2026-10-02"], {
    KIWOOM_OWNER_USER_ID: "fixture-owner",
    KIWOOM_APP_KEY: "fixture-cli-key",
    KIWOOM_APP_SECRET: "fixture-cli-secret",
    KIWOOM_FLOW_ENABLED: "true",
  });
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).status, "configuration");
  assert.match(result.stdout, /explicit --live/);
});
test("collector config does not require broker keys and database check does not migrate or call APIs", () => {
  const config = run(["verify", "--check-config"], {
    KIWOOM_FLOW_ENABLED: "true",
    KIWOOM_FLOW_MODE: "collector",
  });
  const flags = JSON.parse(config.stdout);
  assert.equal(flags.flowEnabled, true);
  assert.equal(flags.credentialsRequired, false);
  assert.equal(flags.appKeyConfigured, false);
  assert.equal(flags.appSecretConfigured, false);
  const missing = run(["verify", "--check-database"]);
  assert.equal(missing.status, 1);
  assert.equal(JSON.parse(missing.stdout).health, "DATABASE_MISSING");
  const cross = run(["verify", "--cross-check"]);
  assert.equal(cross.status, 1);
  assert.match(cross.stdout, /verify --live/);
  const dates = ["--code", "005930", "--from", "2026-09-01", "--to", "2026-10-02"];
  const disabled = run(["verify", "--live", ...dates]);
  assert.equal(JSON.parse(disabled.stdout).health, "DISABLED");
  const secretMissing = run(["verify", "--live", ...dates], {
    KIWOOM_FLOW_ENABLED: "true",
    KIWOOM_APP_KEY: "fixture-cli-key",
  });
  assert.equal(JSON.parse(secretMissing.stdout).health, "CREDENTIALS_MISSING");
  const databaseMissing = run(["verify", "--read-stored", ...dates], {
    KIWOOM_OWNER_USER_ID: "fixture-owner",
  });
  assert.equal(JSON.parse(databaseMissing.stdout).health, "DATABASE_MISSING");
  const devOwner = run(["sync", "--live", ...dates], { KIWOOM_OWNER_USER_ID: "dev-user" });
  assert.equal(JSON.parse(devOwner.stdout).health, "OWNER_AUTH_FAILED");
});
