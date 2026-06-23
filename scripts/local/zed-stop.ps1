$ErrorActionPreference = "SilentlyContinue"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptRoot "..\..")
$dataRoot = if (Test-Path "D:\Xoclon_Holdings\Zed\ZedAI") { "D:\Xoclon_Holdings\Zed\ZedAI" } else { Join-Path $repoRoot "runtime-data" }
$pidRoots = @(
  (Join-Path $dataRoot "runtime\launcher\pids"),
  (Join-Path $dataRoot "runtime\launcher-dev\pids")
)

foreach ($pidRoot in $pidRoots) {
  if (!(Test-Path $pidRoot)) {
    continue
  }

  Get-ChildItem -Path $pidRoot -Filter *.pid | ForEach-Object {
    try {
      $pidValue = (Get-Content $_.FullName -Raw).Trim()
      if ($pidValue) {
        Stop-Process -Id ([int]$pidValue) -Force -ErrorAction SilentlyContinue
      }
    } catch {}
    Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
  }
}

foreach ($port in 5000, 5173) {
  try {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique |
      ForEach-Object {
        Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
      }
  } catch {}
}

Write-Output "ZED managed processes stopped."
