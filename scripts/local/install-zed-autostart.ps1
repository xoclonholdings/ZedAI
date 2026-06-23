$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptRoot "..\..")
$startupScript = Join-Path $scriptRoot "zed-start.ps1"
$taskName = "ZedAI Auto Start"
$currentUser = "$env:USERDOMAIN\$env:USERNAME"

if (!(Test-Path $startupScript)) {
  throw "Missing startup script at $startupScript"
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$startupScript`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew

try {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
} catch {}

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Starts ZED automatically at user logon." `
  -User $currentUser `
  | Out-Null

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $startupScript | Out-Null

Write-Output "Registered scheduled task '$taskName' for $currentUser"
