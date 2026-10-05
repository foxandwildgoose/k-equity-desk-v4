[CmdletBinding()]
param([string]$TaskName = 'KEquityDesk-KiwoomCollector')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'KiwoomCollectorHelpers.ps1')
try {
    if ($env:OS -cne 'Windows_NT') { throw 'Windows is required.' }
    Assert-KiwoomTaskName $TaskName
    $Task = Get-ScheduledTask -TaskName $TaskName -TaskPath '\' -ErrorAction SilentlyContinue
    if (-not $Task) { [pscustomobject]@{ Installed = $false; State = 'NOT_INSTALLED' }; return }
    Assert-KiwoomOwnedTask $Task
    $Info = Get-ScheduledTaskInfo -TaskName $TaskName -TaskPath '\' -ErrorAction Stop
    # Whitelist output; task arguments contain private paths and are never shown.
    [pscustomobject]@{
        Installed = $true
        State = [string]$Task.State
        LastRunTime = $Info.LastRunTime
        NextRunTime = $Info.NextRunTime
        LastTaskResult = $Info.LastTaskResult
    }
} catch {
    [Console]::Error.WriteLine('Kiwoom collector task status unavailable; no private task configuration displayed.')
    exit 1
}
