[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$AppKeyPath,
    [Parameter(Mandatory = $true)][string]$AppSecretPath,
    [Parameter(Mandatory = $true)][string]$DatabaseUrlPath,
    [Parameter(Mandatory = $true)][string]$ExpectedEgressIp,
    [string]$DataScopeId = 'market-global-v1',
    [string]$OwnerUserId,
    [string]$FromDate,
    [string[]]$Symbols = @('stock:005930'),
    [string]$RepeatEverySeconds = '300'
)
$ErrorActionPreference = 'Stop'
$ProjectDirectory = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'KiwoomCollectorHelpers.ps1')
# Windows PowerShell can otherwise select npm.ps1 and fail under a restricted
# script policy. Selecting the command shim needs no global policy change.
$NpmCommand = if ($env:OS -eq 'Windows_NT') { 'npm.cmd' } else { 'npm' }
$CollectorMutex = $null
$MutexHeld = $false
$CollectorInstanceId = [Guid]::NewGuid().ToString()
$HeartbeatEnabled = $false
$SafeErrorCode = 'WORKER_SETUP_FAILED'
try {
    $PollSeconds = Assert-KiwoomPollSeconds $RepeatEverySeconds -AllowOnce
    if ($DataScopeId -notmatch '^[A-Za-z0-9_-]{1,128}$') { throw 'Invalid data scope.' }
    $ParsedIp = $null
    if (-not [Net.IPAddress]::TryParse($ExpectedEgressIp, [ref]$ParsedIp) -or
        $ParsedIp.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork -or
        $ParsedIp.ToString() -cne $ExpectedEgressIp) { throw 'Invalid expected egress IPv4.' }
    if ($Symbols.Count -lt 1 -or $Symbols.Count -gt 10) { throw 'Explicit startup symbols must contain 1 to 10 instruments.' }
    foreach ($Symbol in $Symbols) {
        if ($Symbol -notmatch '^(stock|etf|etn):[0-9A-Z]{6}$') { throw 'Invalid explicit instrument/code.' }
    }
    Set-Location -LiteralPath $ProjectDirectory
    . (Join-Path $PSScriptRoot 'Set-KiwoomSession.ps1') -AppKeyPath $AppKeyPath -AppSecretPath $AppSecretPath
    $DatabaseValue = Read-KiwoomCredentialFile $DatabaseUrlPath
    if ($DatabaseValue -notmatch '^postgres(?:ql)?://') { throw 'Invalid PostgreSQL configuration.' }
    $env:DATABASE_URL = $DatabaseValue
    $env:KIWOOM_DATA_SCOPE_ID = $DataScopeId
    if ($OwnerUserId) { $env:KIWOOM_OWNER_USER_ID = $OwnerUserId }
    $env:KIWOOM_EXPECTED_EGRESS_IP = $ExpectedEgressIp
    $env:KIWOOM_ENV = 'real'
    $env:KIWOOM_FLOW_ENABLED = 'true'
    $env:KIWOOM_FLOW_MODE = 'direct'
    $env:KIWOOM_REQUESTS_PER_SECOND = '2'
    # OS operator authority for this CLI; no fake Better Auth identity is created.
    $Hasher = [Security.Cryptography.SHA256]::Create()
    $LockSuffix = [Convert]::ToBase64String($Hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($env:KIWOOM_APP_KEY))).Replace('/','_').Replace('+','-')
    $Hasher.Dispose()
    # Global namespace also covers scheduled tasks in a different Windows session.
    $CollectorMutex = [Threading.Mutex]::new($false, ('Global\KED-Kiwoom-' + $LockSuffix))
    try { $MutexHeld = $CollectorMutex.WaitOne(0) }
    catch [Threading.AbandonedMutexException] { $MutexHeld = $true }
    if (-not $MutexHeld) { throw 'Collector already running.' }
    # Runtime identity is random and unrelated to broker credentials. This DB-only
    # command does not authenticate with or call Kiwoom.
    & $NpmCommand run kiwoom:heartbeat -- --event start --instance-id $CollectorInstanceId
    if ($LASTEXITCODE -eq 0) { $HeartbeatEnabled = $true }
    elseif ($LASTEXITCODE -eq 3) {
        Write-Output 'Optional collector heartbeat unavailable; telemetry remains unknown.'
    } else { throw 'Collector heartbeat startup failed.' }
    $CollectorArguments = @()
    if ($HeartbeatEnabled) { $CollectorArguments = @('--collector-instance-id', $CollectorInstanceId) }
    try { $SeoulZone = [TimeZoneInfo]::FindSystemTimeZoneById('Korea Standard Time') }
    catch { $SeoulZone = [TimeZoneInfo]::FindSystemTimeZoneById('Asia/Seoul') }
    $Today = [TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $SeoulZone)
    if (-not $FromDate) { $FromDate = $Today.AddDays(-366).ToString('yyyy-MM-dd') }
    $ParsedFromDate = [DateTime]::ParseExact($FromDate, 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture)
    if ($ParsedFromDate.Date -gt $Today.Date) { throw 'Invalid collection start date.' }
    $ToDate = $Today.ToString('yyyy-MM-dd')
    # Gates are ordered: readiness/IP -> real token/three pages -> persistence -> separate-process read.
    $SafeErrorCode = 'STARTUP_DOCTOR_FAILED'
    & $NpmCommand run kiwoom:doctor
    if ($LASTEXITCODE -ne 0) { throw 'Runtime gate failed.' }
    $SafeErrorCode = 'STARTUP_API_FAILED'
    & $NpmCommand run verify:kiwoom -- --live --code 005930 --from $FromDate --to $ToDate
    if ($LASTEXITCODE -eq 2) {
        Write-Output 'Startup metric diagnostic incomplete; authenticated queue collection will continue.'
    } elseif ($LASTEXITCODE -ne 0) { throw 'Real OAuth/API gate failed.' }
    foreach ($Symbol in $Symbols) {
        $Parts = $Symbol.Split(':')
        $SafeErrorCode = 'STARTUP_SYNC_FAILED'
        & $NpmCommand run sync:kiwoom-flow -- --live --code $Parts[1] --instrument $Parts[0] --from $FromDate --to $ToDate --incremental --resume --enqueue @CollectorArguments
        if ($LASTEXITCODE -eq 2) {
            Write-Output 'Initial collection bounded or incomplete; continuing with queued targets.'
        } elseif ($LASTEXITCODE -eq 0) {
            $SafeErrorCode = 'STARTUP_READ_FAILED'
            & $NpmCommand run verify:kiwoom -- --read-stored --code $Parts[1] --instrument $Parts[0] --from $FromDate --to $ToDate
            if ($LASTEXITCODE -ne 0) { throw 'Persistent separate-process read failed.' }
        } else { throw 'Initial collection runtime gate failed.' }
    }
    do {
        $SafeErrorCode = 'QUEUE_CYCLE_FAILED'
        & $NpmCommand run kiwoom:targets -- --live --resume --incremental --limit 10 @CollectorArguments
        if ($LASTEXITCODE -eq 2) {
            Write-Output 'Queue cycle bounded or incomplete; next polling cycle will revisit due targets.'
        } elseif ($LASTEXITCODE -ne 0) { throw 'Target collection runtime gate failed.' }
        if ($PollSeconds -gt 0) { Start-Sleep -Seconds $PollSeconds }
    } while ($PollSeconds -gt 0)
} catch {
    if ($MutexHeld -and $HeartbeatEnabled -and $env:DATABASE_URL) {
        try {
            # One bounded, DB-only attempt. A recording failure cannot replace the
            # original safe failure status; Task Scheduler may restart the worker.
            & $NpmCommand run kiwoom:heartbeat -- --event error --instance-id $CollectorInstanceId --error-code $SafeErrorCode
        } catch { }
    }
    [Console]::Error.WriteLine('Kiwoom collector stopped. Review safe doctor statuses; no secret values displayed.')
    exit 1
} finally {
    if ($MutexHeld) { $CollectorMutex.ReleaseMutex() }
    if ($CollectorMutex) { $CollectorMutex.Dispose() }
    Remove-Variable DatabaseValue, LockSuffix, CollectorInstanceId -ErrorAction SilentlyContinue
    Remove-Item Env:KIWOOM_APP_KEY, Env:KIWOOM_APP_SECRET, Env:DATABASE_URL -ErrorAction SilentlyContinue
}
