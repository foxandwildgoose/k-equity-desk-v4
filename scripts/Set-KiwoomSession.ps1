# Dot-source in the PowerShell session that will launch npm. No machine/user persistent secrets.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$AppKeyPath,
    [Parameter(Mandatory = $true)][string]$AppSecretPath
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'KiwoomCollectorHelpers.ps1')
try {
    # Both files validated before either environment variable changes.
    $KiwoomKeyValue = Read-KiwoomCredentialFile $AppKeyPath
    $KiwoomSecretValue = Read-KiwoomCredentialFile $AppSecretPath
    if ($KiwoomKeyValue -ceq $KiwoomSecretValue) { throw 'Credential roles must be distinct' }
    $env:KIWOOM_APP_KEY = $KiwoomKeyValue
    $env:KIWOOM_APP_SECRET = $KiwoomSecretValue
    Write-Output 'Kiwoom session credentials configured; authentication not yet verified.'
} catch {
    # Suppress original exceptions, path names and file contents.
    throw 'Kiwoom session credential setup failed; environment unchanged.'
} finally {
    Remove-Variable KiwoomKeyValue, KiwoomSecretValue -ErrorAction SilentlyContinue
}
