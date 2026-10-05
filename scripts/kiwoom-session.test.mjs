import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
const pwsh = process.env.KIWOOM_TEST_PWSH ?? "pwsh";
const available =
  spawnSync(pwsh, ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"], {
    encoding: "utf8",
  }).status === 0;
const q = (text) => "'" + text.replaceAll("'", "''") + "'";
const script = resolve("scripts/Set-KiwoomSession.ps1");
function run(key, secret, { missing = false, directory = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "kiwoom-session-test-"));
  const keyPath = join(dir, "fixture_appkey.txt"),
    secretPath = join(dir, "fixture_secretkey.txt");
  writeFileSync(keyPath, key);
  if (directory) mkdirSync(secretPath);
  else if (!missing) writeFileSync(secretPath, secret);
  const child = join(dir, "child.mjs");
  writeFileSync(
    child,
    'process.stdout.write(JSON.stringify({keyOK:process.env.KIWOOM_APP_KEY==="FixtureKey-Case",secretOK:process.env.KIWOOM_APP_SECRET==="FixtureSecret-Case"}));',
  );
  const testScript = join(dir, "run.ps1");
  writeFileSync(
    testScript,
    `$env:KIWOOM_APP_KEY='fixture-old-key'\n$env:KIWOOM_APP_SECRET='fixture-old-secret'\ntry { . ${q(script)} -AppKeyPath ${q(keyPath)} -AppSecretPath ${q(secretPath)}; & ${q(process.execPath)} ${q(child)} } catch { 'VALIDATION_FAILED'; if ($env:KIWOOM_APP_KEY -ceq 'fixture-old-key' -and $env:KIWOOM_APP_SECRET -ceq 'fixture-old-secret') { 'UNCHANGED' } }`,
  );
  const result = spawnSync(pwsh, ["-NoProfile", "-File", testScript], { encoding: "utf8" });
  rmSync(dir, { recursive: true, force: true });
  assert.equal(result.status, 0, result.stderr);
  for (const secretValue of [
    "FixtureKey-Case",
    "FixtureSecret-Case",
    "fixture-old-key",
    "fixture-old-secret",
  ])
    assert.equal((result.stdout + result.stderr).includes(secretValue), false);
  return result.stdout;
}
test(
  "PowerShell dot-source maps explicit secretkey file, handles BOM/trim and passes environment to child",
  { skip: !available },
  () => {
    const output = run("\uFEFF  FixtureKey-Case \r\n", "\uFEFF\tFixtureSecret-Case \r\n");
    assert.match(output, /"keyOK":true,"secretOK":true/);
    assert.match(output, /authentication not yet verified/);
  },
);
test(
  "PowerShell validates both files before updating environment: empty, multiline, missing, directory and same role",
  { skip: !available },
  () => {
    for (const [key, secret, options] of [
      ["FixtureKey-Case", "", {}],
      ["FixtureKey-Case", "one\ntwo", {}],
      ["FixtureKey-Case", "FixtureSecret-Case", { missing: true }],
      ["FixtureKey-Case", "FixtureSecret-Case", { directory: true }],
      ["FixtureKey-Case", "FixtureKey-Case", {}],
      ["\0bad", "FixtureSecret-Case", {}],
    ]) {
      const output = run(key, secret, options);
      assert.match(output, /VALIDATION_FAILED/);
      assert.match(output, /UNCHANGED/);
    }
  },
);

test(
  "PowerShell collector wrapper injects secrets only into its child, uses explicit symbols and clears session values",
  { skip: !available },
  () => {
    const dir = mkdtempSync(join(tmpdir(), "kiwoom-wrapper-test-"));
    const key = join(dir, "fixture_appkey.txt"),
      secret = join(dir, "fixture_secretkey.txt"),
      db = join(dir, "fixture_db.txt");
    writeFileSync(key, "FixtureKey-Case");
    writeFileSync(secret, "FixtureSecret-Case");
    writeFileSync(db, "postgresql://fixture.test/isolated");
    const collector = resolve("scripts/Run-KiwoomCollector.ps1");
    const testScript = join(dir, "run.ps1");
    writeFileSync(
      testScript,
      `function global:npm { ('CALL:' + $args[1]); if ($env:KIWOOM_APP_KEY -ceq 'FixtureKey-Case' -and $env:KIWOOM_APP_SECRET -ceq 'FixtureSecret-Case' -and $env:DATABASE_URL -ceq 'postgresql://fixture.test/isolated' -and $env:KIWOOM_FLOW_MODE -ceq 'direct' -and $env:KIWOOM_DATA_SCOPE_ID -ceq 'fixture-market') { 'CHILD_CONFIG_OK' }; $global:LASTEXITCODE=0 }\n& ${q(collector)} -AppKeyPath ${q(key)} -AppSecretPath ${q(secret)} -DatabaseUrlPath ${q(db)} -DataScopeId 'fixture-market' -ExpectedEgressIp '192.0.2.1' -FromDate '2026-09-01' -Symbols 'stock:005930','etf:069500'\nif (-not $env:KIWOOM_APP_KEY -and -not $env:KIWOOM_APP_SECRET -and -not $env:DATABASE_URL) { 'CLEARED' }`,
    );
    const result = spawnSync(pwsh, ["-NoProfile", "-File", testScript], { encoding: "utf8" });
    rmSync(dir, { recursive: true, force: true });
    assert.equal(result.status, 0, result.stderr);
    // Doctor + real-page gate + sync/read for each symbol + bounded target polling.
    assert.equal((result.stdout.match(/CHILD_CONFIG_OK/g) ?? []).length, 7);
    assert.deepEqual([...result.stdout.matchAll(/CALL:([^\r\n]+)/g)].map(match => match[1]), [
      "kiwoom:doctor", "verify:kiwoom", "sync:kiwoom-flow", "verify:kiwoom",
      "sync:kiwoom-flow", "verify:kiwoom", "kiwoom:targets",
    ]);
    assert.match(result.stdout, /CLEARED/);
    for (const value of [
      "FixtureKey-Case",
      "FixtureSecret-Case",
      "postgresql://fixture.test/isolated",
    ])
      assert.equal((result.stdout + result.stderr).includes(value), false);
  },
);
