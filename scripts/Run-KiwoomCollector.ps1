[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$AppKeyPath,
    [Parameter(Mandatory = $true)][string]$AppSecretPath,
    [Parameter(Mandatory = $true)][string]$DatabaseUrlPath,
    [Parameter(Mandatory = $true)][string]$OwnerUserId,
    [Parameter(Mandatory = $true)][string]$ExpectedEgressIp,
    [Parameter(Mandatory = $true)][string]$FromDate,
    [Parameter(Mandatory = $true)][string[]]$Symbols,
    [int]$RepeatEverySeconds = 0
)
$ErrorActionPreference = 'Stop'
$ProjectDirectory = Split-Path -Parent $PSScriptRoot
if ($RepeatEverySeconds -ne 0 -and $RepeatEverySeconds -lt 60) { throw 'Collector interval must be 0 or at least 60 seconds.' }
foreach ($Symbol in $Symbols) {
    if ($Symbol -notmatch '^(stock|etf|etn):[0-9A-Z]{6}$') { throw 'Invalid explicit instrument/code selection.' }
}
try {
    Set-Location -LiteralPath $ProjectDirectory
    . (Join-Path $PSScriptRoot 'Set-KiwoomSession.ps1') -AppKeyPath $AppKeyPath -AppSecretPath $AppSecretPath
    $DatabaseValue = Read-KiwoomCredentialFile $DatabaseUrlPath
    if ($DatabaseValue -notmatch '^postgres(?:ql)?://') { throw 'Invalid PostgreSQL configuration.' }
    $env:DATABASE_URL = $DatabaseValue
    $env:KIWOOM_OWNER_USER_ID = $OwnerUserId
    $env:KIWOOM_EXPECTED_EGRESS_IP = $ExpectedEgressIp
    $env:KIWOOM_ENV = 'real'
    $env:KIWOOM_FLOW_ENABLED = 'true'
    $env:KIWOOM_FLOW_MODE = 'direct'
    $env:KIWOOM_REQUESTS_PER_SECOND = '2'
    try { $SeoulZone = [TimeZoneInfo]::FindSystemTimeZoneById('Korea Standard Time') }
    catch { $SeoulZone = [TimeZoneInfo]::FindSystemTimeZoneById('Asia/Seoul') }
    do {
        $ToDate = [TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $SeoulZone).ToString('yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture)
        foreach ($Symbol in $Symbols) {
            $Parts = $Symbol.Split(':')
            & npm run sync:kiwoom-flow -- --live --code $Parts[1] --instrument $Parts[0] --from $FromDate --to $ToDate --incremental --resume
            if ($LASTEXITCODE -ne 0) { throw 'Collection incomplete or failed; inspect safe diagnostics and resume initial history separately.' }
        }
        if ($RepeatEverySeconds -gt 0) { Start-Sleep -Seconds $RepeatEverySeconds }
    } while ($RepeatEverySeconds -gt 0)
} catch {
    throw 'Kiwoom collector stopped; no credentials or configuration values displayed.'
} finally {
    Remove-Variable DatabaseValue -ErrorAction SilentlyContinue
    Remove-Item Env:KIWOOM_APP_KEY, Env:KIWOOM_APP_SECRET, Env:DATABASE_URL -ErrorAction SilentlyContinue
}
