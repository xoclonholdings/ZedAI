$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ollamaRoot = "D:\Ollama"
$modelsRoot = "D:\.ollama\models"
$hostValue = "0.0.0.0:11434"

if (!(Test-Path $ollamaRoot)) {
  throw "Ollama is not installed at $ollamaRoot"
}

if (!(Test-Path $modelsRoot)) {
  New-Item -ItemType Directory -Path $modelsRoot -Force | Out-Null
}

$env:OLLAMA_MODELS = $modelsRoot
$env:OLLAMA_HOST = $hostValue

$ollamaExe = Join-Path $ollamaRoot "ollama.exe"
if (!(Test-Path $ollamaExe)) {
  throw "Missing Ollama executable at $ollamaExe"
}

& $ollamaExe serve
