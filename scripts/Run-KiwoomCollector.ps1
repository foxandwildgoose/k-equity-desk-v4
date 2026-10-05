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
    [int]$RepeatEverySeconds = 0
)
$ErrorActionPreference = 'Stop'
$ProjectDirectory = Split-Path -Parent $PSScriptRoot
# Windows PowerShell can otherwise select npm.ps1 and fail under a restricted
# script policy. Selecting the command shim needs no global policy change.
$NpmCommand = if ($env:OS -eq 'Windows_NT') { 'npm.cmd' } else { 'npm' }
$CollectorMutex = $null
$MutexHeld = $false
try {
    if ($RepeatEverySeconds -ne 0 -and $RepeatEverySeconds -lt 60) { throw 'Invalid interval.' }
    if ($DataScopeId -notmatch '^[A-Za-z0-9_-]{1,128}$') { throw 'Invalid data scope.' }
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
    try { $SeoulZone = [TimeZoneInfo]::FindSystemTimeZoneById('Korea Standard Time') }
    catch { $SeoulZone = [TimeZoneInfo]::FindSystemTimeZoneById('Asia/Seoul') }
    $Today = [TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $SeoulZone)
    if (-not $FromDate) { $FromDate = $Today.AddDays(-366).ToString('yyyy-MM-dd') }
    $ToDate = $Today.ToString('yyyy-MM-dd')
    # Gates are ordered: readiness/IP -> real token/three pages -> persistence -> separate-process read.
    & $NpmCommand run kiwoom:doctor
    if ($LASTEXITCODE -ne 0) { throw 'Runtime gate failed.' }
    & $NpmCommand run verify:kiwoom -- --live --code 005930 --from $FromDate --to $ToDate
    if ($LASTEXITCODE -ne 0) { throw 'Real OAuth/API gate failed.' }
    foreach ($Symbol in $Symbols) {
        $Parts = $Symbol.Split(':')
        & $NpmCommand run sync:kiwoom-flow -- --live --code $Parts[1] --instrument $Parts[0] --from $FromDate --to $ToDate --incremental --resume
        if ($LASTEXITCODE -ne 0) { throw 'Initial collection partial or failed; resume required.' }
        & $NpmCommand run verify:kiwoom -- --read-stored --code $Parts[1] --instrument $Parts[0] --from $FromDate --to $ToDate
        if ($LASTEXITCODE -ne 0) { throw 'Persistent separate-process read failed.' }
    }
    do {
        & $NpmCommand run kiwoom:targets -- --live --resume --incremental --limit 10
        if ($LASTEXITCODE -ne 0) { throw 'Target collection partial or failed; next scheduled run can resume.' }
        if ($RepeatEverySeconds -gt 0) { Start-Sleep -Seconds $RepeatEverySeconds }
    } while ($RepeatEverySeconds -gt 0)
} catch {
    Write-Error 'Kiwoom collector stopped. Review safe doctor statuses; no secret values displayed.'
    exit 1
} finally {
    if ($MutexHeld) { $CollectorMutex.ReleaseMutex() }
    if ($CollectorMutex) { $CollectorMutex.Dispose() }
    Remove-Variable DatabaseValue, LockSuffix -ErrorAction SilentlyContinue
    Remove-Item Env:KIWOOM_APP_KEY, Env:KIWOOM_APP_SECRET, Env:DATABASE_URL -ErrorAction SilentlyContinue
}
