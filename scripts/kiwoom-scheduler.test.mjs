import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const pwsh = process.env.KIWOOM_TEST_PWSH ?? "pwsh";
const available =
  spawnSync(pwsh, ["-NoProfile", "-Command", "'OK'"], { encoding: "utf8" }).status === 0;
const q = (value) => "'" + value.replaceAll("'", "''") + "'";
const names = [
  "Install-KiwoomCollectorTask",
  "Uninstall-KiwoomCollectorTask",
  "Get-KiwoomCollectorStatus",
  "Run-KiwoomCollector",
  "Set-KiwoomSession",
  "KiwoomCollectorHelpers",
];
const scriptRoot = resolve("scripts");
const secrets = [
  "UniqueFixture-AppKey",
  "UniqueFixture-Secret",
  "postgresql://fixture.test/private_database",
];

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "kiwoom-task-test-"));
  const repo = join(directory, "repository with spaces & apostrophe's");
  const scripts = join(repo, "scripts");
  mkdirSync(scripts, { recursive: true });
  for (const name of names)
    copyFileSync(join(scriptRoot, `${name}.ps1`), join(scripts, `${name}.ps1`));
  // Only the Windows identity adapter is replaced. All production installer,
  // path/credential validation and command generation run unchanged.
  const helper = join(scripts, "KiwoomCollectorHelpers.ps1");
  writeFileSync(
    helper,
    readFileSync(helper, "utf8") +
      "\nfunction Get-KiwoomTaskUserIdentity { return 'S-1-5-21-100-200-300-1001' }\n",
  );
  writeFileSync(
    join(repo, "package.json"),
    JSON.stringify({
      scripts: Object.fromEntries(
        [
          "kiwoom:heartbeat",
          "kiwoom:doctor",
          "verify:kiwoom",
          "sync:kiwoom-flow",
          "kiwoom:targets",
        ].map((name) => [name, "fixture"]),
      ),
    }),
  );
  const files = [
    join(directory, "key fixture_appkey.txt"),
    join(directory, "secret fixture_secretkey.txt"),
    join(directory, "database.txt"),
  ];
  files.forEach((file, i) => writeFileSync(file, secrets[i]));
  const engines = Object.fromEntries(
    ["pwsh.exe", "powershell.exe", "node.exe", "npm.cmd"].map((name) => {
      const file = join(directory, name);
      writeFileSync(file, "fixture executable, not launched");
      return [name, file];
    }),
  );
  return { directory, repo, scripts, files, engines };
}

function mockCommands(f, { unrelated = false, existing = false, running = false } = {}) {
  return `
$env:OS='Windows_NT'
$global:Registered=0; $global:Started=0; $global:Stopped=0; $global:Removed=0; $global:Task=$null
function global:Get-Command { param([string]$Name,[string]$CommandType) switch($Name) {
${Object.entries(f.engines)
  .map(([name, file]) => `${q(name)} { [pscustomobject]@{Source=${q(file)}} }`)
  .join("\n")}
default { throw 'Unexpected executable lookup' }
} }
function global:Get-ScheduledTask { param($TaskName,$TaskPath) return $global:Task }
function global:New-ScheduledTaskAction { param($Execute,$Argument,$WorkingDirectory) [pscustomobject]@{Execute=$Execute;Arguments=$Argument;WorkingDirectory=$WorkingDirectory} }
function global:New-ScheduledTaskTrigger { param([switch]$AtLogOn,$User) [pscustomobject]@{AtLogOn=[bool]$AtLogOn;UserId=$User;Enabled=$true;CimClass=[pscustomobject]@{CimClassName='MSFT_TaskLogonTrigger'}} }
function global:New-ScheduledTaskPrincipal { param($UserId,$LogonType,$RunLevel) [pscustomobject]@{UserId=$UserId;LogonType=$LogonType;RunLevel=$RunLevel} }
function global:New-ScheduledTaskSettingsSet { param($MultipleInstances,[switch]$StartWhenAvailable,[switch]$RunOnlyIfNetworkAvailable,$RestartCount,$RestartInterval,$ExecutionTimeLimit,[switch]$AllowStartIfOnBatteries,[switch]$DontStopIfGoingOnBatteries)
[pscustomobject]@{MultipleInstances=$MultipleInstances;Enabled=$true;StartWhenAvailable=[bool]$StartWhenAvailable;RunOnlyIfNetworkAvailable=[bool]$RunOnlyIfNetworkAvailable;RestartCount=$RestartCount;RestartInterval=[Xml.XmlConvert]::ToString($RestartInterval);ExecutionTimeLimit=[Xml.XmlConvert]::ToString($ExecutionTimeLimit);DisallowStartIfOnBatteries=(-not [bool]$AllowStartIfOnBatteries);StopIfGoingOnBatteries=(-not [bool]$DontStopIfGoingOnBatteries)} }
function global:New-ScheduledTask { param($Action,$Trigger,$Principal,$Settings,$Description) [pscustomobject]@{Actions=@($Action);Triggers=@($Trigger);Principal=$Principal;Settings=$Settings;Description=$Description;State='Ready'} }
function global:Register-ScheduledTask { param($TaskName,$TaskPath,$InputObject) $global:Registered++; $global:Task=$InputObject }
function global:Start-ScheduledTask { param($TaskName,$TaskPath) $global:Started++; $global:Task.State='Running' }
function global:Stop-ScheduledTask { param($TaskName,$TaskPath) $global:Stopped++; $global:Task.State='Ready' }
function global:Unregister-ScheduledTask { param($TaskName,$TaskPath,[switch]$Confirm) $global:Removed++; $global:Task=$null }
function global:Get-ScheduledTaskInfo { param($TaskName,$TaskPath) [pscustomobject]@{LastRunTime='fixture-time';NextRunTime='fixture-next';LastTaskResult=0;SensitiveOther='NOT_ALLOWED'} }
${unrelated ? "$global:Task=[pscustomobject]@{Description='unrelated task';State='Running'}" : ""}
${existing ? `$first=& ${q(join(f.scripts, "Install-KiwoomCollectorTask.ps1"))} ${installerArgs(f)}; $global:Registered=0; $global:Started=0; $global:Task.State=${q(running ? "Running" : "Ready")}` : ""}
`;
}
function installerArgs(f, overrides = {}) {
  const opts = {
    RepositoryDirectory: f.repo,
    AppKeyPath: f.files[0],
    AppSecretPath: f.files[1],
    DatabaseUrlPath: f.files[2],
    ExpectedEgressIp: "192.0.2.1",
    ...overrides,
  };
  return Object.entries(opts)
    .map(([name, value]) => `-${name} ${q(value)}`)
    .join(" ");
}
function run(f, code) {
  const script = join(f.directory, "test.ps1");
  // & invokes a child script in this test harness; propagate its native-style
  // exit status just as Task Scheduler does when launching PowerShell -File.
  writeFileSync(script, code + "\nif ($LASTEXITCODE) { exit $LASTEXITCODE }\n");
  return spawnSync(pwsh, ["-NoProfile", "-File", script], { encoding: "utf8", timeout: 30000 });
}
function resultJson(result) {
  const line = result.stdout.split(/\r?\n/).find((line) => line.startsWith("JSON:"));
  assert.ok(line, result.stderr);
  return JSON.parse(line.slice(5));
}
function assertSecretsAbsent(result) {
  for (const value of secrets) assert.equal((result.stdout + result.stderr).includes(value), false);
}

test(
  "Scheduled Task installer quotes literal private file arguments, uses current interactive limited user and resilient single-worker settings",
  { skip: !available },
  () => {
    const f = fixture();
    try {
      const result = run(
        f,
        mockCommands(f) +
          `
$env:KIWOOM_APP_KEY='unchanged'; $env:KIWOOM_APP_SECRET='unchanged'; $env:DATABASE_URL='unchanged'
$message=& ${q(join(f.scripts, "Install-KiwoomCollectorTask.ps1"))} ${installerArgs(f)}
'JSON:'+(@{Task=$global:Task;Registered=$global:Registered;Started=$global:Started;Message=$message;EnvUnchanged=($env:KIWOOM_APP_KEY -ceq 'unchanged' -and $env:KIWOOM_APP_SECRET -ceq 'unchanged' -and $env:DATABASE_URL -ceq 'unchanged')} | ConvertTo-Json -Depth 8 -Compress)
`,
      );
      assert.equal(result.status, 0, result.stderr);
      assertSecretsAbsent(result);
      const data = resultJson(result);
      assert.equal(data.EnvUnchanged, true);
      assert.equal(data.Registered, 1);
      assert.equal(data.Started, 1);
      assert.equal(data.Task.Actions[0].Execute, f.engines["pwsh.exe"]);
      assert.equal(data.Task.Actions[0].WorkingDirectory, f.repo);
      const args = data.Task.Actions[0].Arguments;
      for (const file of f.files) assert.ok(args.includes(`"${file}"`));
      assert.match(args, /^"-NoProfile" "-ExecutionPolicy" "Bypass" "-File" /);
      assert.match(args, /"-RepeatEverySeconds" "300"$/);
      assert.equal(data.Task.Triggers[0].AtLogOn, true);
      assert.equal(data.Task.Principal.LogonType, "Interactive");
      assert.equal(data.Task.Principal.RunLevel, "Limited");
      assert.deepEqual(data.Task.Settings, {
        MultipleInstances: "IgnoreNew",
        StartWhenAvailable: true,
        Enabled: true,
        RunOnlyIfNetworkAvailable: true,
        RestartCount: 12,
        RestartInterval: "PT5M",
        ExecutionTimeLimit: "PT0S",
        DisallowStartIfOnBatteries: false,
        StopIfGoingOnBatteries: false,
      });
      for (const file of f.files) assert.equal(String(data.Message).includes(file), false);
    } finally {
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);

test(
  "Scheduled Task interval validation rejects fractions, overflow and unsupported intervals before registration",
  { skip: !available },
  () => {
    const f = fixture();
    try {
      for (const interval of ["0", "59", "601", "300.5", "99999999999999999999", "3e2", "-300"]) {
        const result = run(
          f,
          mockCommands(f) +
            `function global:Register-ScheduledTask { throw 'REGISTRATION_MUST_NOT_HAPPEN' }; & ${q(join(f.scripts, "Install-KiwoomCollectorTask.ps1"))} ${installerArgs(f, { PollSeconds: interval })}`,
        );
        assert.equal(result.status, 1, result.stderr);
        assertSecretsAbsent(result);
        assert.doesNotMatch(result.stdout + result.stderr, /REGISTRATION_MUST_NOT_HAPPEN/);
        assert.match(result.stdout + result.stderr, /installation failed/);
      }
      for (const interval of ["60", "600"]) {
        const result = run(
          f,
          mockCommands(f) +
            `& ${q(join(f.scripts, "Install-KiwoomCollectorTask.ps1"))} ${installerArgs(f, { PollSeconds: interval })}`,
        );
        assert.equal(result.status, 0, result.stderr);
      }
    } finally {
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);

test(
  "Scheduled Task validates all private files before any registration and refuses repository secrets or malformed arguments",
  { skip: !available },
  () => {
    const f = fixture();
    try {
      const inside = join(f.repo, "inside_secretkey.txt");
      writeFileSync(inside, secrets[1]);
      for (const overrides of [
        { AppSecretPath: inside },
        { AppKeyPath: "relative_appkey.txt" },
        { AppSecretPath: join(f.directory, "missing.txt") },
        { AppSecretPath: f.directory },
        { DatabaseUrlPath: 'invalid"path' },
        { ExpectedEgressIp: "invalid-ip" },
        { TaskName: "folder\\unrelated" },
        { PowerShellPath: f.engines["node.exe"] },
      ]) {
        const result = run(
          f,
          mockCommands(f) +
            `function global:Register-ScheduledTask { throw 'REGISTRATION_MUST_NOT_HAPPEN' }; & ${q(join(f.scripts, "Install-KiwoomCollectorTask.ps1"))} ${installerArgs(f, overrides)}`,
        );
        assert.equal(result.status, 1, result.stderr);
        assertSecretsAbsent(result);
        for (const file of f.files) assert.equal(result.stderr.includes(file), false);
        assert.doesNotMatch(result.stdout + result.stderr, /REGISTRATION_MUST_NOT_HAPPEN/);
      }
      writeFileSync(f.files[2], "not-a-database-url");
      const result = run(
        f,
        mockCommands(f) +
          `& ${q(join(f.scripts, "Install-KiwoomCollectorTask.ps1"))} ${installerArgs(f)}`,
      );
      assert.equal(result.status, 1);
      assertSecretsAbsent(result);
      assert.doesNotMatch(result.stderr, /not-a-database-url/);
    } finally {
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);

test(
  "Owned task installation is idempotent, unrelated tasks are preserved, and status/uninstall disclose no private task configuration",
  { skip: !available },
  () => {
    const f = fixture();
    try {
      for (const running of [true, false]) {
        const result = run(
          f,
          mockCommands(f, { existing: true, running }) +
            `
$message=& ${q(join(f.scripts, "Install-KiwoomCollectorTask.ps1"))} ${installerArgs(f)}
$status=& ${q(join(f.scripts, "Get-KiwoomCollectorStatus.ps1"))}
'JSON:'+(@{Registered=$global:Registered;Started=$global:Started;Status=$status;Message=$message} | ConvertTo-Json -Depth 5 -Compress)
`,
        );
        assert.equal(result.status, 0, result.stderr);
        const data = resultJson(result);
        assert.equal(data.Registered, 0);
        assert.equal(data.Started, running ? 0 : 1);
        assert.deepEqual(
          Object.keys(data.Status).sort(),
          ["Installed", "State", "LastRunTime", "NextRunTime", "LastTaskResult"].sort(),
        );
        for (const file of f.files) assert.equal(result.stdout.includes(file), false);
        assertSecretsAbsent(result);
      }
      const uninstall = run(
        f,
        mockCommands(f, { existing: true, running: true }) +
          `
$message=& ${q(join(f.scripts, "Uninstall-KiwoomCollectorTask.ps1"))}
'JSON:'+(@{Stopped=$global:Stopped;Removed=$global:Removed;Message=$message} | ConvertTo-Json -Compress)
`,
      );
      assert.equal(uninstall.status, 0, uninstall.stderr);
      assert.equal(resultJson(uninstall).Stopped, 1);
      assert.equal(resultJson(uninstall).Removed, 1);
      for (const name of ["Install-KiwoomCollectorTask", "Uninstall-KiwoomCollectorTask"]) {
        const result = run(
          f,
          mockCommands(f, { unrelated: true }) +
            `& ${q(join(f.scripts, `${name}.ps1`))} ${name.startsWith("Install") ? installerArgs(f) : ""}`,
        );
        assert.equal(result.status, 1);
        assertSecretsAbsent(result);
      }
    } finally {
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);

test(
  "Task reuse refuses security/runtime drift and status/uninstall reject another Windows user's managed task",
  { skip: !available },
  () => {
    const f = fixture();
    try {
      for (const mutation of [
        "$global:Task.Principal.RunLevel='Highest'",
        "$global:Task.Principal.LogonType='Password'",
        "$global:Task.Settings.MultipleInstances='Parallel'",
        "$global:Task.Settings.Enabled=$false",
        "$global:Task.Settings.RestartCount=3",
        "$global:Task.Settings.RestartInterval='PT1M'",
        "$global:Task.Settings.ExecutionTimeLimit='PT72H'",
        "$global:Task.Settings.StartWhenAvailable=$false",
        "$global:Task.Settings.RunOnlyIfNetworkAvailable=$false",
        "$global:Task.Triggers=@()",
        "$global:Task.Triggers[0].CimClass.CimClassName='MSFT_TaskBootTrigger'",
        "$global:Task.Triggers[0].UserId='S-1-5-21-400-500-600-1002'",
      ]) {
        const result = run(
          f,
          mockCommands(f, { existing: true, running: true }) +
            `
${mutation}
& ${q(join(f.scripts, "Install-KiwoomCollectorTask.ps1"))} ${installerArgs(f)}
'JSON:'+(@{Registered=$global:Registered;Started=$global:Started;Stopped=$global:Stopped;Removed=$global:Removed} | ConvertTo-Json -Compress)
`,
        );
        assert.equal(result.status, 1, mutation);
        assert.deepEqual(resultJson(result), { Registered: 0, Started: 0, Stopped: 0, Removed: 0 });
        assertSecretsAbsent(result);
      }
      for (const name of [
        "Install-KiwoomCollectorTask",
        "Get-KiwoomCollectorStatus",
        "Uninstall-KiwoomCollectorTask",
      ]) {
        const result = run(
          f,
          mockCommands(f, { existing: true, running: true }) +
            `
$global:Task.Principal.UserId='S-1-5-21-400-500-600-1002'
& ${q(join(f.scripts, `${name}.ps1`))} ${name.startsWith("Install") ? installerArgs(f) : ""}
'JSON:'+(@{Registered=$global:Registered;Started=$global:Started;Stopped=$global:Stopped;Removed=$global:Removed} | ConvertTo-Json -Compress)
`,
        );
        assert.equal(result.status, 1, name);
        assert.deepEqual(resultJson(result), { Registered: 0, Started: 0, Stopped: 0, Removed: 0 });
        assertSecretsAbsent(result);
      }
    } finally {
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);

test(
  "Windows-compatible PowerShell scripts parse without PS7-only language constructs",
  { skip: !available },
  () => {
    const f = fixture();
    try {
      const result = run(
        f,
        `$files=@(${names.map((name) => q(join(scriptRoot, `${name}.ps1`))).join(",")})
foreach($file in $files) { $tokens=$null; $errors=$null; $ast=[Management.Automation.Language.Parser]::ParseFile($file,[ref]$tokens,[ref]$errors); if($errors.Count -gt 0) { exit 1 }; if($tokens | Where-Object { $_.Text -in @('??','??=','&&','||','?.') }) { exit 1 } }; 'WINDOWS_COMPATIBLE_PARSE_OK'`,
      );
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /WINDOWS_COMPATIBLE_PARSE_OK/);
    } finally {
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);

test(
  "Persistent worker validates once, repeatedly polls bounded targets with one runtime identity and records safe failure",
  { skip: !available },
  () => {
    const f = fixture();
    try {
      const result = run(
        f,
        `$env:OS='Windows_NT';$global:Sleeps=0
function global:npm.cmd { 'CALL:'+($args -join ' '); $global:LASTEXITCODE=0 }
function global:Start-Sleep { param($Seconds) if($Seconds -ne 300) { throw 'INVALID_POLL' }; $global:Sleeps++; if($global:Sleeps -ge 2) { throw 'FIXTURE_STOP' } }
& ${q(join(f.scripts, "Run-KiwoomCollector.ps1"))} -AppKeyPath ${q(f.files[0])} -AppSecretPath ${q(f.files[1])} -DatabaseUrlPath ${q(f.files[2])} -ExpectedEgressIp '192.0.2.1' -FromDate '2026-09-01' -RepeatEverySeconds '300'`,
      );
      assert.equal(result.status, 1);
      assertSecretsAbsent(result);
      const calls = [...result.stdout.matchAll(/CALL:([^\r\n]+)/g)].map((match) => match[1]);
      assert.equal(calls.filter((line) => line === "run kiwoom:doctor").length, 1);
      assert.equal(calls.filter((line) => line.startsWith("run verify:kiwoom --live")).length, 1);
      assert.equal(calls.filter((line) => line.startsWith("run sync:kiwoom-flow")).length, 1);
      const polls = calls.filter((line) => line.startsWith("run kiwoom:targets"));
      assert.equal(polls.length, 2);
      assert.equal(polls[0], polls[1]);
      assert.match(polls[0], /--limit 10 --collector-instance-id [a-f0-9-]{36}$/);
      const instance = calls[0].match(/--instance-id ([a-f0-9-]{36})$/)?.[1];
      assert.ok(instance);
      assert.ok(polls.every((line) => line.endsWith(instance)));
      assert.ok(calls.find((line) => line.startsWith("run sync:kiwoom-flow")).endsWith(instance));
      assert.ok(calls.at(-1).endsWith(`--instance-id ${instance} --error-code QUEUE_CYCLE_FAILED`));
      assert.doesNotMatch(result.stderr, /FIXTURE_STOP|INVALID_POLL/);
    } finally {
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);

test(
  "A second worker cannot acquire the existing global broker-credential mutex or touch the runtime heartbeat",
  { skip: !available },
  async () => {
    const f = fixture();
    const lockerScript = join(f.directory, "locker.ps1");
    writeFileSync(
      lockerScript,
      `
. ${q(join(f.scripts, "KiwoomCollectorHelpers.ps1"))}
$key=Read-KiwoomCredentialFile ${q(f.files[0])}
$hasher=[Security.Cryptography.SHA256]::Create()
$suffix=[Convert]::ToBase64String($hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($key))).Replace('/','_').Replace('+','-')
$mutex=[Threading.Mutex]::new($false,('Global\\KED-Kiwoom-'+$suffix))
$held=$mutex.WaitOne(0)
try { if(-not $held) { exit 1 }; [Console]::Out.WriteLine('LOCK_READY'); [Console]::Out.Flush(); [Console]::ReadLine() | Out-Null }
finally { if($held) { $mutex.ReleaseMutex() }; $mutex.Dispose(); $hasher.Dispose() }
`,
    );
    const locker = spawn(pwsh, ["-NoProfile", "-File", lockerScript], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    try {
      await new Promise((resolveReady, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Fixture mutex holder did not start")),
          10000,
        );
        locker.stdout.on("data", (chunk) => {
          if (String(chunk).includes("LOCK_READY")) {
            clearTimeout(timeout);
            resolveReady();
          }
        });
        locker.once("error", (error) => {
          clearTimeout(timeout);
          reject(error);
        });
        locker.once("exit", (code) => {
          clearTimeout(timeout);
          if (code !== 0) reject(new Error("Fixture mutex holder failed"));
        });
      });
      const result = run(
        f,
        `$env:OS='Windows_NT'
function global:npm.cmd { 'UNEXPECTED_BROKER_OR_HEARTBEAT_CALL'; $global:LASTEXITCODE=0 }
& ${q(join(f.scripts, "Run-KiwoomCollector.ps1"))} -AppKeyPath ${q(f.files[0])} -AppSecretPath ${q(f.files[1])} -DatabaseUrlPath ${q(f.files[2])} -ExpectedEgressIp '192.0.2.1' -FromDate '2026-09-01'
if(-not $env:KIWOOM_APP_KEY -and -not $env:KIWOOM_APP_SECRET -and -not $env:DATABASE_URL) { 'CLEARED' }`,
      );
      assert.equal(result.status, 1, result.stderr);
      assertSecretsAbsent(result);
      assert.doesNotMatch(result.stdout + result.stderr, /UNEXPECTED_BROKER_OR_HEARTBEAT_CALL/);
      assert.match(result.stdout, /CLEARED/);
    } finally {
      locker.stdin.end("\n");
      if (locker.exitCode === null) locker.kill();
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);
