param(
  [string[]]$Models = @("llama3.1:8b", "qwen2.5-coder:7b", "nomic-embed-text")
)

$ErrorActionPreference = "Stop"

function Ensure-Dir([string]$Path) {
  if (!(Test-Path $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Wait-ForOllama([int]$TimeoutSeconds = 90) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri "http://127.0.0.1:11434/api/tags" -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -eq 200) {
        return $true
      }
    } catch {}
    Start-Sleep -Seconds 3
  }
  return $false
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptRoot "..\..")
$ollamaRoot = "D:\Ollama"
$modelsRoot = "D:\.ollama\models"
$downloadZip = Join-Path $ollamaRoot "ollama-windows-amd64.zip"
$ollamaExe = Join-Path $ollamaRoot "ollama.exe"
$hostScript = Join-Path $scriptRoot "zed-ollama-host.ps1"
$taskName = "ZedAI Ollama Host"
$currentUser = "$env:USERDOMAIN\$env:USERNAME"

Ensure-Dir $ollamaRoot
Ensure-Dir $modelsRoot

[Environment]::SetEnvironmentVariable("OLLAMA_MODELS", $modelsRoot, "User")
[Environment]::SetEnvironmentVariable("OLLAMA_HOST", "0.0.0.0:11434", "User")
[Environment]::SetEnvironmentVariable("OLLAMA_MODEL", "llama3.1:8b", "User")
[Environment]::SetEnvironmentVariable("ZED_LOCAL_PROVIDER", "ollama", "User")
[Environment]::SetEnvironmentVariable("ZED_LOCAL_MODEL", "llama3.1:8b", "User")

if (!(Test-Path $ollamaExe)) {
  Invoke-WebRequest -Uri "https://ollama.com/download/ollama-windows-amd64.zip" -OutFile $downloadZip
  Expand-Archive -Path $downloadZip -DestinationPath $ollamaRoot -Force
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$hostScript`""
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
  -Description "Starts the local Ollama model host for ZED." `
  -User $currentUser `
  | Out-Null

$env:OLLAMA_MODELS = $modelsRoot
$env:OLLAMA_HOST = "0.0.0.0:11434"

$existing = Get-Process -Name "ollama" -ErrorAction SilentlyContinue
if (-not $existing) {
  Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", $hostScript) `
    -WindowStyle Hidden `
    | Out-Null
}

if (-not (Wait-ForOllama)) {
  throw "Ollama host did not become ready on http://127.0.0.1:11434"
}

foreach ($model in $Models) {
  & $ollamaExe pull $model
}

Write-Output "Ollama model host installed and models pulled: $($Models -join ', ')"
