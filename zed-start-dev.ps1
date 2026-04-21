param(
  [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"

function Ensure-Dir([string]$Path) {
  if (!(Test-Path $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Start-ManagedProcess(
  [string]$Name,
  [string]$WorkingDirectory,
  [string[]]$Arguments,
  [string]$PidFile,
  [string]$LogDir
) {
  if (Test-Path $PidFile) {
    try {
      $pidValue = (Get-Content $PidFile -Raw).Trim()
      $existing = Get-Process -Id ([int]$pidValue) -ErrorAction SilentlyContinue
      if ($existing) {
        return $existing
      }
    } catch {}
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
  }

  $proc = Start-Process `
    -FilePath "npm.cmd" `
    -ArgumentList $Arguments `
    -WorkingDirectory $WorkingDirectory `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $LogDir "$Name.stdout.log") `
    -RedirectStandardError (Join-Path $LogDir "$Name.stderr.log") `
    -PassThru

  Set-Content -Path $PidFile -Value $proc.Id -NoNewline
  return $proc
}

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$dataRoot = if (Test-Path "D:\Xoclon_Holdings\Zed\ZedAI") { "D:\Xoclon_Holdings\Zed\ZedAI" } else { Join-Path $repoRoot "runtime-data" }
$launcherRoot = Join-Path $dataRoot "runtime\launcher-dev"
$logDir = Join-Path $launcherRoot "logs"
$pidDir = Join-Path $launcherRoot "pids"
$tempDir = Join-Path $launcherRoot "temp"
$npmCacheDir = Join-Path $launcherRoot ".npm-cache"

Ensure-Dir $logDir
Ensure-Dir $pidDir
Ensure-Dir $tempDir
Ensure-Dir $npmCacheDir

$env:ZED_DATA_ROOT = $dataRoot
$env:TEMP = $tempDir
$env:TMP = $tempDir
$env:npm_config_cache = $npmCacheDir
$env:NODE_ENV = "development"

$serverProc = Start-ManagedProcess `
  -Name "zed-server-dev" `
  -WorkingDirectory (Join-Path $repoRoot "server") `
  -Arguments @("run", "dev") `
  -PidFile (Join-Path $pidDir "zed-server-dev.pid") `
  -LogDir $logDir

$clientProc = Start-ManagedProcess `
  -Name "zed-client-dev" `
  -WorkingDirectory (Join-Path $repoRoot "client") `
  -Arguments @("run", "dev", "--", "--host", "0.0.0.0") `
  -PidFile (Join-Path $pidDir "zed-client-dev.pid") `
  -LogDir $logDir

if ($OpenBrowser.IsPresent) {
  Start-Sleep -Seconds 6
  Start-Process "http://127.0.0.1:5173/"
}

Write-Output "ZED dev server PID: $($serverProc.Id)"
Write-Output "ZED dev client PID: $($clientProc.Id)"
