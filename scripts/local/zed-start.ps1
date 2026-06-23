param(
  [switch]$RebuildClient,
  [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"

function Ensure-Dir([string]$Path) {
  if (!(Test-Path $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Get-LatestWrite([string]$Path) {
  if (!(Test-Path $Path)) {
    return [datetime]::MinValue
  }
  $items = Get-ChildItem -Path $Path -Recurse -File -ErrorAction SilentlyContinue
  if (!$items) {
    return [datetime]::MinValue
  }
  return ($items | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime
}

function Wait-ForHttp([string]$Url, [int]$TimeoutSeconds = 60) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $true
      }
    } catch {}
    Start-Sleep -Seconds 2
  }
  return $false
}

function Stop-StaleProcess([string]$PidFile) {
  if (!(Test-Path $PidFile)) {
    return
  }
  try {
    $pidValue = (Get-Content $PidFile -Raw).Trim()
    if ($pidValue) {
      $proc = Get-Process -Id ([int]$pidValue) -ErrorAction SilentlyContinue
      if ($proc -and $proc.HasExited -eq $false) {
        return $proc
      }
    }
  } catch {}
  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
  return $null
}

function Start-ManagedProcess(
  [string]$Name,
  [string]$CommandPath,
  [string[]]$Arguments,
  [string]$WorkingDirectory,
  [string]$PidFile,
  [string]$LogDir
) {
  $existing = Stop-StaleProcess -PidFile $PidFile
  if ($existing) {
    return $existing
  }

  $stdout = Join-Path $LogDir "$Name.stdout.log"
  $stderr = Join-Path $LogDir "$Name.stderr.log"
  $proc = Start-Process `
    -FilePath $CommandPath `
    -ArgumentList $Arguments `
    -WorkingDirectory $WorkingDirectory `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -PassThru

  Set-Content -Path $PidFile -Value $proc.Id -NoNewline
  return $proc
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptRoot "..\..")
$serverDir = Join-Path $repoRoot "server"
$clientDir = Join-Path $repoRoot "client"
$sharedDir = Join-Path $repoRoot "shared"
$dataRoot = if (Test-Path "D:\Xoclon_Holdings\Zed\ZedAI") { "D:\Xoclon_Holdings\Zed\ZedAI" } else { Join-Path $repoRoot "runtime-data" }
$runtimeRoot = Join-Path $dataRoot "runtime"
$launcherRoot = Join-Path $runtimeRoot "launcher"
$logDir = Join-Path $launcherRoot "logs"
$pidDir = Join-Path $launcherRoot "pids"
$tempDir = Join-Path $launcherRoot "temp"
$npmCacheDir = Join-Path $launcherRoot ".npm-cache"

Ensure-Dir $runtimeRoot
Ensure-Dir $launcherRoot
Ensure-Dir $logDir
Ensure-Dir $pidDir
Ensure-Dir $tempDir
Ensure-Dir $npmCacheDir

$env:ZED_DATA_ROOT = $dataRoot
$env:TEMP = $tempDir
$env:TMP = $tempDir
$env:npm_config_cache = $npmCacheDir
$env:NODE_ENV = "local"
if (-not $env:PORT) {
  $env:PORT = "5000"
}

if (!(Test-Path (Join-Path $serverDir "node_modules"))) {
  Push-Location $serverDir
  try {
    & npm.cmd install
  } finally {
    Pop-Location
  }
}

if (!(Test-Path (Join-Path $sharedDir "node_modules"))) {
  Push-Location $sharedDir
  try {
    & npm.cmd install
  } finally {
    Pop-Location
  }
}

if (!(Test-Path (Join-Path $clientDir "node_modules"))) {
  Push-Location $clientDir
  try {
    & npm.cmd install
  } finally {
    Pop-Location
  }
}

$distIndex = Join-Path $clientDir "dist\index.html"
$shouldBuildClient = $RebuildClient.IsPresent -or !(Test-Path $distIndex)

if (-not $shouldBuildClient) {
  $sourceLatest = @(
    Get-LatestWrite (Join-Path $clientDir "src"),
    Get-LatestWrite (Join-Path $clientDir "public"),
    if (Test-Path (Join-Path $clientDir "index.html")) { (Get-Item (Join-Path $clientDir "index.html")).LastWriteTime } else { [datetime]::MinValue }
  ) | Sort-Object -Descending | Select-Object -First 1
  $distLatest = (Get-Item $distIndex).LastWriteTime
  $shouldBuildClient = $sourceLatest -gt $distLatest
}

if ($shouldBuildClient) {
  Push-Location $clientDir
  try {
    & npm.cmd run build
  } finally {
    Pop-Location
  }
}

$serverPidFile = Join-Path $pidDir "zed-server.pid"
$serverUrl = "http://127.0.0.1:$($env:PORT)/"
$serverAlreadyReachable = Wait-ForHttp -Url $serverUrl -TimeoutSeconds 3

if (-not $serverAlreadyReachable) {
  $serverProc = Start-ManagedProcess `
    -Name "zed-server" `
    -CommandPath "npm.cmd" `
    -Arguments @("run", "start") `
    -WorkingDirectory $serverDir `
    -PidFile $serverPidFile `
    -LogDir $logDir

  $ready = Wait-ForHttp -Url $serverUrl
  if (-not $ready) {
    throw "ZED server did not become ready on $serverUrl"
  }
} else {
  $serverProc = Stop-StaleProcess -PidFile $serverPidFile
}

if ($OpenBrowser.IsPresent) {
  Start-Process $serverUrl
}

$pidText = if ($serverProc) { " with PID $($serverProc.Id)" } else { "" }
Write-Output "ZED available at $serverUrl$pidText"
