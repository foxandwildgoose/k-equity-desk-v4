[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$RepositoryDirectory,
    [Parameter(Mandatory = $true)][string]$AppKeyPath,
    [Parameter(Mandatory = $true)][string]$AppSecretPath,
    [Parameter(Mandatory = $true)][string]$DatabaseUrlPath,
    [Parameter(Mandatory = $true)][string]$ExpectedEgressIp,
    [string]$DataScopeId = 'market-global-v1',
    [string]$PollSeconds = '300',
    [string]$TaskName = 'KEquityDesk-KiwoomCollector',
    [string]$PowerShellPath
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'KiwoomCollectorHelpers.ps1')
try {
    if ($env:OS -cne 'Windows_NT') { throw 'Windows is required.' }
    Assert-KiwoomTaskName $TaskName
    $ValidatedPoll = Assert-KiwoomPollSeconds $PollSeconds
    if ($DataScopeId -notmatch '^[A-Za-z0-9_-]{1,128}$') { throw 'Invalid data scope.' }
    $ParsedIp = $null
    if (-not [Net.IPAddress]::TryParse($ExpectedEgressIp, [ref]$ParsedIp) -or
        $ParsedIp.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork -or
        $ParsedIp.ToString() -cne $ExpectedEgressIp) { throw 'Expected egress must be an IPv4 address.' }
    $Repo = Resolve-KiwoomTaskPath $RepositoryDirectory -Directory
    $Worker = Resolve-KiwoomTaskPath (Join-Path $Repo 'scripts/Run-KiwoomCollector.ps1')
    $null = Resolve-KiwoomTaskPath (Join-Path $Repo 'scripts/Set-KiwoomSession.ps1')
    $null = Resolve-KiwoomTaskPath (Join-Path $Repo 'scripts/KiwoomCollectorHelpers.ps1')
    $PackageFile = Resolve-KiwoomTaskPath (Join-Path $Repo 'package.json')
    $Package = [IO.File]::ReadAllText($PackageFile) | ConvertFrom-Json
    foreach ($ScriptName in @('kiwoom:heartbeat', 'kiwoom:doctor', 'verify:kiwoom', 'sync:kiwoom-flow', 'kiwoom:targets')) {
        if (-not $Package.scripts.$ScriptName) { throw 'Collector npm commands are not installed.' }
    }
    $KeyFile = Assert-KiwoomPrivateFile $AppKeyPath $Repo
    $SecretFile = Assert-KiwoomPrivateFile $AppSecretPath $Repo
    $DatabaseFile = Assert-KiwoomPrivateFile $DatabaseUrlPath $Repo
    # Reuse the session reader without modifying this process's environment.
    $KeyValue = Read-KiwoomCredentialFile $KeyFile
    $SecretValue = Read-KiwoomCredentialFile $SecretFile
    $DatabaseValue = Read-KiwoomCredentialFile $DatabaseFile
    if ($KeyValue -ceq $SecretValue -or $DatabaseValue -notmatch '^postgres(?:ql)?://') { throw 'Invalid credential roles or database configuration.' }
    foreach ($CommandName in @('node.exe', 'npm.cmd')) {
        $Command = Get-Command -Name $CommandName -CommandType Application -ErrorAction Stop
        $null = Resolve-KiwoomTaskPath $Command.Source
    }
    if (-not $PowerShellPath) {
        $Engine = Get-Command -Name 'pwsh.exe' -CommandType Application -ErrorAction SilentlyContinue
        if (-not $Engine) { $Engine = Get-Command -Name 'powershell.exe' -CommandType Application -ErrorAction Stop }
        $PowerShellPath = $Engine.Source
    }
    $EnginePath = Resolve-KiwoomTaskPath $PowerShellPath
    if ([IO.Path]::GetFileName($EnginePath) -notmatch '^(pwsh|powershell)\.exe$') { throw 'An explicit PowerShell executable is required.' }
    $UserSid = Get-KiwoomTaskUserIdentity
    $Arguments = @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $Worker,
        '-AppKeyPath', $KeyFile, '-AppSecretPath', $SecretFile,
        '-DatabaseUrlPath', $DatabaseFile, '-ExpectedEgressIp', $ExpectedEgressIp,
        '-DataScopeId', $DataScopeId, '-RepeatEverySeconds', [string]$ValidatedPoll
    )
    $ArgumentString = (($Arguments | ForEach-Object { ConvertTo-KiwoomTaskArgument $_ }) -join ' ')
    $Existing = Get-ScheduledTask -TaskName $TaskName -TaskPath '\' -ErrorAction SilentlyContinue
    if ($Existing) {
        Assert-KiwoomOwnedTask $Existing
        Assert-KiwoomTaskRuntimeSettings $Existing
        if (@($Existing.Actions).Count -ne 1 -or
            $Existing.Actions[0].Execute -cne $EnginePath -or
            $Existing.Actions[0].Arguments -cne $ArgumentString -or
            $Existing.Actions[0].WorkingDirectory -cne $Repo) {
            throw 'Owned task settings differ; uninstall it explicitly before reinstalling.'
        }
        if ([string]$Existing.State -ne 'Running') { Start-ScheduledTask -TaskName $TaskName -TaskPath '\' -ErrorAction Stop }
        Write-Output 'Kiwoom collector task already installed; start requested if needed.'
        return
    }
    $Action = New-ScheduledTaskAction -Execute $EnginePath -Argument $ArgumentString -WorkingDirectory $Repo
    $Trigger = New-ScheduledTaskTrigger -AtLogOn -User $UserSid
    # No stored password, SYSTEM account, elevation or boot-time privilege bypass.
    $Principal = New-ScheduledTaskPrincipal -UserId $UserSid -LogonType Interactive -RunLevel Limited
    $Settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -RunOnlyIfNetworkAvailable `
        -RestartCount 12 -RestartInterval ([TimeSpan]::FromMinutes(5)) -ExecutionTimeLimit ([TimeSpan]::Zero) `
        -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    $Task = New-ScheduledTask -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Description (Get-KiwoomTaskOwnerMarker)
    $null = Register-ScheduledTask -TaskName $TaskName -TaskPath '\' -InputObject $Task -ErrorAction Stop
    Start-ScheduledTask -TaskName $TaskName -TaskPath '\' -ErrorAction Stop
    Write-Output 'Kiwoom collector task installed; start requested. Verify safe task and collector status.'
} catch {
    [Console]::Error.WriteLine('Kiwoom collector task installation failed. Check Windows user, validated paths, npm installation and task-name ownership; no private values displayed.')
    exit 1
} finally {
    Remove-Variable KeyValue, SecretValue, DatabaseValue, ArgumentString, Arguments, UserSid -ErrorAction SilentlyContinue
}
