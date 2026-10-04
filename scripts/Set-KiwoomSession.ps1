# Dot-source in the PowerShell session that will launch npm. No machine/user persistent secrets.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$AppKeyPath,
    [Parameter(Mandatory = $true)][string]$AppSecretPath
)
$ErrorActionPreference = 'Stop'
function Read-KiwoomCredentialFile([string]$FilePath) {
    try {
        $Item = Get-Item -LiteralPath $FilePath -ErrorAction Stop
        if (-not ($Item -is [System.IO.FileInfo]) -or ($Item.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
            throw 'Invalid credential file'
        }
        if ($Item.Length -gt 16384) { throw 'Invalid credential file' }
        $Text = [System.IO.File]::ReadAllText($Item.FullName, [System.Text.UTF8Encoding]::new($false, $true))
        $Text = $Text.TrimStart([char]0xFEFF).Trim()
        if ([string]::IsNullOrWhiteSpace($Text) -or $Text.Contains("`n") -or $Text.Contains("`r") -or $Text.Contains([char]0)) {
            throw 'Invalid credential file'
        }
        return $Text
    } catch { throw 'Credential file validation failed (no values displayed)' }
}
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
