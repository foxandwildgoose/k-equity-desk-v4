# Shared file validation. No secret values or private file paths are emitted.
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

function Assert-KiwoomPollSeconds([string]$Value, [switch]$AllowOnce) {
    if ($AllowOnce -and $Value -ceq '0') { return 0 }
    if ($Value -notmatch '^[0-9]{2,3}$') { throw 'Polling interval must be a whole number between 60 and 600 seconds.' }
    $Number = [int]$Value
    if ($Number -lt 60 -or $Number -gt 600) { throw 'Polling interval must be a whole number between 60 and 600 seconds.' }
    return $Number
}

function Assert-KiwoomTaskName([string]$TaskName) {
    if ($TaskName -notmatch '^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$') { throw 'Invalid collector task name.' }
}

function Get-KiwoomTaskOwnerMarker {
    return 'KEquityDesk Kiwoom collector task v1 (managed by Install-KiwoomCollectorTask.ps1)'
}

function Get-KiwoomTaskUserIdentity {
    $Identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    try {
        if (-not $Identity.IsAuthenticated -or -not $Identity.User -or
            [Diagnostics.Process]::GetCurrentProcess().SessionId -le 0 -or
            $Identity.User.Value -in @('S-1-5-18', 'S-1-5-19', 'S-1-5-20')) {
            throw 'Interactive Windows user required.'
        }
        return $Identity.User.Value
    } finally { $Identity.Dispose() }
}

function Resolve-KiwoomTaskPath([string]$Value, [switch]$Directory) {
    if ([string]::IsNullOrWhiteSpace($Value) -or $Value -match '[\x00-\x1F"\x7F]' -or -not [IO.Path]::IsPathRooted($Value)) {
        throw 'An absolute literal path is required.'
    }
    $Item = Get-Item -LiteralPath $Value -ErrorAction Stop
    if ($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked paths are not permitted.' }
    if ($Directory) {
        if (-not ($Item -is [IO.DirectoryInfo])) { throw 'Repository directory is invalid.' }
    } elseif (-not ($Item -is [IO.FileInfo])) { throw 'A regular file is required.' }
    return $Item.FullName
}

function Assert-KiwoomPrivateFile([string]$FilePath, [string]$RepositoryDirectory) {
    $Resolved = Resolve-KiwoomTaskPath $FilePath
    $RepositoryPrefix = $RepositoryDirectory.TrimEnd([char[]]@('\', '/')) + [IO.Path]::DirectorySeparatorChar
    if ($Resolved.StartsWith($RepositoryPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Secret files must be outside the repository.'
    }
    # A parent junction could otherwise disguise an in-repository secret file.
    $Parent = [IO.DirectoryInfo]::new([IO.Path]::GetDirectoryName($Resolved))
    while ($Parent) {
        if ($Parent.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked private directories are not permitted.' }
        $Parent = $Parent.Parent
    }
    return $Resolved
}

function ConvertTo-KiwoomTaskArgument([string]$Value) {
    if ($Value -match '[\x00-\x1F"\x7F]') { throw 'Invalid task argument.' }
    # Windows command-line quoting; arguments to -File are literal parameters.
    # Double trailing backslashes before the closing quote (paths may end in one).
    return '"' + ([regex]::Replace($Value, '(\\+)$', '$1$1')) + '"'
}

function Resolve-KiwoomTaskUserSid([string]$TaskUser) {
    if ($TaskUser -match '^S-[0-9]+(?:-[0-9]+)+$') {
        return $TaskUser
    }
    return ([Security.Principal.NTAccount]::new($TaskUser)).Translate([Security.Principal.SecurityIdentifier]).Value
}

function Assert-KiwoomOwnedTask($Task) {
    if ($Task.Description -cne (Get-KiwoomTaskOwnerMarker)) { throw 'The task name belongs to an unrelated task.' }
    $TaskSid = Resolve-KiwoomTaskUserSid ([string]$Task.Principal.UserId)
    if ($TaskSid -cne (Get-KiwoomTaskUserIdentity)) { throw 'The task belongs to a different Windows user.' }
}

function Get-KiwoomTaskDurationSeconds($Duration) {
    if ($Duration -is [TimeSpan]) { return $Duration.TotalSeconds }
    if ([string]::IsNullOrWhiteSpace([string]$Duration)) { throw 'Task duration is missing.' }
    return [Xml.XmlConvert]::ToTimeSpan([string]$Duration).TotalSeconds
}

function Assert-KiwoomTaskRuntimeSettings($Task) {
    $Principal = $Task.Principal
    $Settings = $Task.Settings
    $Triggers = @($Task.Triggers)
    if ([string]$Principal.RunLevel -notin @('0', 'Limited') -or
        [string]$Principal.LogonType -notin @('3', 'Interactive') -or
        [string]$Settings.MultipleInstances -notin @('2', 'IgnoreNew') -or
        -not $Settings.Enabled -or [string]$Task.State -eq 'Disabled' -or
        -not $Settings.StartWhenAvailable -or -not $Settings.RunOnlyIfNetworkAvailable -or
        $Settings.RestartCount -ne 12 -or
        (Get-KiwoomTaskDurationSeconds $Settings.RestartInterval) -ne 300 -or
        (Get-KiwoomTaskDurationSeconds $Settings.ExecutionTimeLimit) -ne 0 -or
        $Settings.DisallowStartIfOnBatteries -or $Settings.StopIfGoingOnBatteries -or
        $Triggers.Count -ne 1 -or -not $Triggers[0].Enabled -or
        $Triggers[0].CimClass.CimClassName -cne 'MSFT_TaskLogonTrigger' -or
        (Resolve-KiwoomTaskUserSid ([string]$Triggers[0].UserId)) -cne (Get-KiwoomTaskUserIdentity)) {
        throw 'Owned task security or runtime settings differ; uninstall before reinstalling.'
    }
}
