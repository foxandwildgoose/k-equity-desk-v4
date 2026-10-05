[CmdletBinding()]
param([string]$TaskName = 'KEquityDesk-KiwoomCollector')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'KiwoomCollectorHelpers.ps1')
try {
    if ($env:OS -cne 'Windows_NT') { throw 'Windows is required.' }
    Assert-KiwoomTaskName $TaskName
    $Task = Get-ScheduledTask -TaskName $TaskName -TaskPath '\' -ErrorAction SilentlyContinue
    if (-not $Task) { Write-Output 'Kiwoom collector task is not installed.'; return }
    Assert-KiwoomOwnedTask $Task
    if ([string]$Task.State -eq 'Running') { Stop-ScheduledTask -TaskName $TaskName -TaskPath '\' -ErrorAction Stop }
    Unregister-ScheduledTask -TaskName $TaskName -TaskPath '\' -Confirm:$false -ErrorAction Stop
    Write-Output 'Kiwoom collector task removed. Repository and private files were preserved.'
} catch {
    [Console]::Error.WriteLine('Kiwoom collector task removal failed; only an owned task may be removed. No private values displayed.')
    exit 1
}
