import assert from "node:assert/strict";
import { test } from "node:test";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const pwsh = process.env.KIWOOM_TEST_PWSH ?? "pwsh";
const available =
  spawnSync(pwsh, ["-NoProfile", "-Command", "'OK'"], { encoding: "utf8" }).status === 0;
const q = (value) => "'" + value.replaceAll("'", "''") + "'";
const scriptRoot = resolve("scripts");
const secrets = [
  "WorkerFixture-AppKey",
  "WorkerFixture-AppSecret",
  "postgresql://fixture.test/worker_private_database",
];

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "kiwoom-worker-test-"));
  const repo = join(directory, "repository with spaces & apostrophe's");
  const scripts = join(repo, "scripts");
  mkdirSync(scripts, { recursive: true });
  for (const name of [
    "Run-KiwoomCollector",
    "Set-KiwoomSession",
    "KiwoomCollectorHelpers",
  ]) {
    copyFileSync(join(scriptRoot, `${name}.ps1`), join(scripts, `${name}.ps1`));
  }
  const files = [
    join(directory, "key fixture_appkey.txt"),
    join(directory, "secret fixture_secretkey.txt"),
    join(directory, "database.txt"),
  ];
  files.forEach((file, index) => writeFileSync(file, secrets[index]));
  return { directory, scripts, files };
}

function runWorker(f, {
  sync = [0],
  queue = [0],
  doctor = 0,
  api = 0,
  read = 0,
  heartbeatStart = 0,
  repeat = false,
  useDefaultInterval = false,
  stopAfterSleeps = 2,
  symbols = ["stock:005930"],
} = {}) {
  const script = join(f.directory, "test.ps1");
  writeFileSync(script, `
$env:OS='Windows_NT'
$global:SyncPlan=@(${sync.join(",")})
$global:QueuePlan=@(${queue.join(",")})
$global:SyncCount=0; $global:QueueCount=0; $global:Sleeps=0
function global:npm.cmd {
    # PowerShell consumes the standalone -- when calling a function mock.
    'CALL:'+($args -join ' ')
    $global:LASTEXITCODE=0
    switch ([string]$args[1]) {
        'kiwoom:heartbeat' {
            if ($args -contains 'start') { $global:LASTEXITCODE=${heartbeatStart} }
        }
        'kiwoom:doctor' { $global:LASTEXITCODE=${doctor} }
        'verify:kiwoom' {
            if ($args -contains '--live') { $global:LASTEXITCODE=${api} }
            else { $global:LASTEXITCODE=${read} }
        }
        'sync:kiwoom-flow' {
            $index=[Math]::Min($global:SyncCount,$global:SyncPlan.Count-1)
            $global:LASTEXITCODE=$global:SyncPlan[$index]
            $global:SyncCount++
        }
        'kiwoom:targets' {
            $index=[Math]::Min($global:QueueCount,$global:QueuePlan.Count-1)
            $global:LASTEXITCODE=$global:QueuePlan[$index]
            $global:QueueCount++
        }
        default { throw 'UNEXPECTED_COMMAND' }
    }
}
function global:Start-Sleep {
    param($Seconds)
    if ($Seconds -ne 300) { throw 'INVALID_POLL_INTERVAL' }
    $global:Sleeps++
    if ($global:Sleeps -ge ${stopAfterSleeps}) {
        throw ${q(`Fixture stop: ${secrets[0]} ${secrets[1]} ${secrets[2]} ${f.files[0]}`)}
    }
}
& ${q(join(f.scripts, "Run-KiwoomCollector.ps1"))} -AppKeyPath ${q(f.files[0])} -AppSecretPath ${q(f.files[1])} -DatabaseUrlPath ${q(f.files[2])} -ExpectedEgressIp '192.0.2.1' -FromDate '2026-09-01' -Symbols @(${symbols.map(q).join(",")}) ${useDefaultInterval ? "" : `-RepeatEverySeconds '${repeat ? "300" : "0"}'`}
$workerExit=$LASTEXITCODE
$cleared=(-not $env:KIWOOM_APP_KEY -and -not $env:KIWOOM_APP_SECRET -and -not $env:DATABASE_URL)
# Probe on another thread: same-thread WaitOne would reenter a leaked mutex.
Add-Type @'
using System.Threading;
public static class WorkerMutexProbe {
    public static bool IsAvailable(string name) {
        bool acquired = false;
        Thread thread = new Thread(() => {
            using (Mutex mutex = new Mutex(false, name)) {
                try { acquired = mutex.WaitOne(0); }
                catch (AbandonedMutexException) { acquired = true; }
                finally { if (acquired) mutex.ReleaseMutex(); }
            }
        });
        thread.Start();
        thread.Join();
        return acquired;
    }
}
'@
$hasher=[Security.Cryptography.SHA256]::Create()
$suffix=[Convert]::ToBase64String($hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes(${q(secrets[0])}))).Replace('/','_').Replace('+','-')
$released=[WorkerMutexProbe]::IsAvailable('Global\\KED-Kiwoom-'+$suffix)
$hasher.Dispose()
'CLEANUP:'+(@{CredentialVariablesCleared=$cleared;MutexReleased=$released;Sleeps=$global:Sleeps} | ConvertTo-Json -Compress)
exit $workerExit
`);
  return spawnSync(pwsh, ["-NoProfile", "-File", script], {
    encoding: "utf8",
    timeout: 30000,
  });
}

function calls(result) {
  return [...result.stdout.matchAll(/CALL:([^\r\n]+)/g)].map((match) => match[1]);
}

function assertSafeCleanup(f, result, expectedSleeps = 0) {
  assert.equal(result.error, undefined, result.error?.message);
  const output = result.stdout + result.stderr;
  for (const secret of secrets) assert.equal(output.includes(secret), false, "Secret leaked");
  for (const file of f.files) assert.equal(output.includes(file), false, "Private file path leaked");
  assert.doesNotMatch(output, /Fixture stop|INVALID_POLL_INTERVAL|UNEXPECTED_COMMAND/);
  const line = result.stdout.split(/\r?\n/).find((line) => line.startsWith("CLEANUP:"));
  assert.ok(line, result.stderr);
  assert.deepEqual(JSON.parse(line.slice("CLEANUP:".length)), {
    CredentialVariablesCleared: true,
    MutexReleased: true,
    Sleeps: expectedSleeps,
  });
}

function assertIdentity(commandCalls) {
  const start = commandCalls.find((call) => call.startsWith("run kiwoom:heartbeat --event start"));
  const instance = start?.match(/--instance-id ([a-f0-9-]{36})$/)?.[1];
  assert.ok(instance, `Worker start must create a safe runtime identity: ${commandCalls.join("\n")}`);
  for (const call of commandCalls.filter((call) =>
    /run (sync:kiwoom-flow|kiwoom:targets)/.test(call))) {
    assert.ok(call.endsWith(`--collector-instance-id ${instance}`), call);
  }
  return instance;
}

test("Partial startup seed skips its stored read and still reaches the queue", { skip: !available }, () => {
  const f = fixture();
  try {
    const result = runWorker(f, {
      sync: [2, 0],
      symbols: ["stock:005930", "stock:000660"],
    });
    assert.equal(result.status, 0, result.stderr);
    assertSafeCleanup(f, result);
    const commandCalls = calls(result);
    assertIdentity(commandCalls);
    const seeds = commandCalls.filter((call) => call.startsWith("run sync:kiwoom-flow"));
    assert.equal(seeds.length, 2);
    assert.match(seeds[0], /--code 005930 --instrument stock/);
    assert.match(seeds[1], /--code 000660 --instrument stock/);
    for (const seed of seeds) assert.match(seed, /--resume --enqueue /);
    const reads = commandCalls.filter((call) => call.startsWith("run verify:kiwoom --read-stored"));
    assert.equal(reads.length, 1);
    assert.match(reads[0], /--code 000660 --instrument stock/);
    assert.equal(commandCalls.filter((call) => call.startsWith("run kiwoom:targets")).length, 1);
    assert.equal(commandCalls.filter((call) => call.includes("--event error")).length, 0);
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Incomplete startup API diagnostic continues queued seeds and another stock", { skip: !available }, () => {
  const f = fixture();
  try {
    const result = runWorker(f, {
      api: 2,
      sync: [2, 0],
      symbols: ["stock:005930", "stock:018260"],
      queue: [0],
    });
    assert.equal(result.status, 0, result.stderr);
    assertSafeCleanup(f, result);
    const commandCalls = calls(result);
    assertIdentity(commandCalls);
    assert.equal(commandCalls.filter((call) => call.startsWith("run verify:kiwoom --live")).length, 1);
    const seeds = commandCalls.filter((call) => call.startsWith("run sync:kiwoom-flow"));
    assert.equal(seeds.length, 2);
    assert.match(seeds[0], /--code 005930 --instrument stock/);
    assert.match(seeds[1], /--code 018260 --instrument stock/);
    for (const seed of seeds) assert.match(seed, /--resume --enqueue /);
    const reads = commandCalls.filter((call) => call.startsWith("run verify:kiwoom --read-stored"));
    assert.equal(reads.length, 1);
    assert.match(reads[0], /--code 018260 --instrument stock/);
    assert.equal(commandCalls.filter((call) => call.startsWith("run kiwoom:targets")).length, 1);
    assert.equal(commandCalls.filter((call) => call.includes("--event error")).length, 0);
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Partial queue poll continues to the next successful poll with one worker identity", { skip: !available }, () => {
  const f = fixture();
  try {
    const result = runWorker(f, { queue: [2, 0], repeat: true });
    // The sleep fixture ends the otherwise persistent worker after two cycles.
    assert.equal(result.status, 1, result.stderr);
    assertSafeCleanup(f, result, 2);
    const commandCalls = calls(result);
    const instance = assertIdentity(commandCalls);
    assert.equal(commandCalls.filter((call) => call === "run kiwoom:doctor").length, 1);
    assert.equal(commandCalls.filter((call) => call.startsWith("run verify:kiwoom --live")).length, 1);
    assert.equal(commandCalls.filter((call) => call.startsWith("run sync:kiwoom-flow")).length, 1);
    const polls = commandCalls.filter((call) => call.startsWith("run kiwoom:targets"));
    assert.equal(polls.length, 2);
    assert.equal(polls[0], polls[1]);
    assert.match(polls[0], /--live --resume --incremental --limit 10 --collector-instance-id [a-f0-9-]{36}$/);
    assert.equal(commandCalls.at(-1), `run kiwoom:heartbeat --event error --instance-id ${instance} --error-code QUEUE_CYCLE_FAILED`);
    assert.equal(commandCalls.filter((call) => call.includes("--event error")).length, 1);
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Omitting the polling interval keeps the worker polling every 300 seconds", { skip: !available }, () => {
  const f = fixture();
  try {
    const result = runWorker(f, { useDefaultInterval: true });
    assert.equal(result.status, 1, result.stderr);
    assertSafeCleanup(f, result, 2);
    const commandCalls = calls(result);
    assertIdentity(commandCalls);
    assert.equal(commandCalls.filter((call) => call === "run kiwoom:doctor").length, 1);
    assert.equal(commandCalls.filter((call) => call.startsWith("run kiwoom:targets")).length, 2);
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

for (const gate of [
  { name: "doctor/IP", options: { doctor: 1 }, error: "STARTUP_DOCTOR_FAILED", beforeStop: 2 },
  { name: "OAuth/API", options: { api: 1 }, error: "STARTUP_API_FAILED", beforeStop: 3 },
]) {
  test(`Fatal ${gate.name} gate stops without broker retry and records a safe error`, { skip: !available }, () => {
    const f = fixture();
    try {
      const result = runWorker(f, { ...gate.options, repeat: true });
      assert.equal(result.status, 1, result.stderr);
      assertSafeCleanup(f, result);
      const commandCalls = calls(result);
      const instance = assertIdentity(commandCalls);
      assert.equal(commandCalls.length, gate.beforeStop + 1);
      assert.equal(commandCalls.filter((call) => call.startsWith("run sync:kiwoom-flow") || call.startsWith("run kiwoom:targets")).length, 0);
      assert.equal(commandCalls.at(-1), `run kiwoom:heartbeat --event error --instance-id ${instance} --error-code ${gate.error}`);
    } finally {
      rmSync(f.directory, { recursive: true, force: true });
    }
  });
}

test("Fatal queue exit stops immediately without sleep or another poll", { skip: !available }, () => {
  const f = fixture();
  try {
    const result = runWorker(f, { queue: [1, 0], repeat: true });
    assert.equal(result.status, 1, result.stderr);
    assertSafeCleanup(f, result);
    const commandCalls = calls(result);
    const instance = assertIdentity(commandCalls);
    assert.equal(commandCalls.filter((call) => call.startsWith("run kiwoom:targets")).length, 1);
    assert.equal(commandCalls.at(-1), `run kiwoom:heartbeat --event error --instance-id ${instance} --error-code QUEUE_CYCLE_FAILED`);
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Missing optional heartbeat migration permits partial recovery without collector telemetry", { skip: !available }, () => {
  const f = fixture();
  try {
    const result = runWorker(f, { heartbeatStart: 3, sync: [2], queue: [2, 0], repeat: true });
    assert.equal(result.status, 1, result.stderr);
    assertSafeCleanup(f, result, 2);
    const commandCalls = calls(result);
    const heartbeats = commandCalls.filter((call) => call.startsWith("run kiwoom:heartbeat"));
    assert.equal(heartbeats.length, 1);
    assert.match(heartbeats[0], /^run kiwoom:heartbeat --event start --instance-id [a-f0-9-]{36}$/);
    assert.equal(commandCalls.filter((call) => call.startsWith("run kiwoom:targets")).length, 2);
    assert.equal(commandCalls.filter((call) => call.startsWith("run sync:kiwoom-flow")).length, 1);
    assert.equal(commandCalls.filter((call) => call.includes("--read-stored")).length, 0);
    for (const call of commandCalls.slice(1)) assert.doesNotMatch(call, /--collector-instance-id|--instance-id|--event/);
    assert.doesNotMatch(result.stdout + result.stderr, /\bRUNNING\b/);
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Missing optional heartbeat migration still stops on fatal queue without error registration", { skip: !available }, () => {
  const f = fixture();
  try {
    const result = runWorker(f, { heartbeatStart: 3, queue: [1, 0], repeat: true });
    assert.equal(result.status, 1, result.stderr);
    assertSafeCleanup(f, result);
    const commandCalls = calls(result);
    assert.equal(commandCalls.filter((call) => call.startsWith("run kiwoom:heartbeat")).length, 1);
    assert.equal(commandCalls.filter((call) => call.startsWith("run kiwoom:targets")).length, 1);
    assert.ok(commandCalls.at(-1).startsWith("run kiwoom:targets"));
    for (const call of commandCalls.slice(1)) assert.doesNotMatch(call, /--collector-instance-id|--instance-id|--event/);
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});
