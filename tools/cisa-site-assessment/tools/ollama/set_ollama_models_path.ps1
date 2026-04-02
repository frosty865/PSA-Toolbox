<#
.SYNOPSIS
  Set OLLAMA_MODELS and startup directory on the Ollama NSSM service so "ollama list" finds models after an update.
.DESCRIPTION
  Ensures Services\ollama exists as the service startup directory, sets OLLAMA_MODELS to data\ollama\models,
  updates NSSM AppDirectory and AppEnvironmentExtra, then restarts the service.
.PARAMETER ServiceName
  NSSM service name (default: psa-ollama; fallback VOFC-Ollama).
.PARAMETER ModelsPath
  Full path to Ollama models folder (default: from PSA_SYSTEM_ROOT\Data\ollama\models, same as install_psa_ollama_service.ps1).
.EXAMPLE
  pwsh -ExecutionPolicy Bypass -File tools\ollama\set_ollama_models_path.ps1
.EXAMPLE
  pwsh -ExecutionPolicy Bypass -File tools\ollama\set_ollama_models_path.ps1 -ServiceName VOFC-Ollama
#>
param(
  [string]$ServiceName = "psa-ollama",
  [string]$ModelsPath = ""   # empty = use PSA_SYSTEM_ROOT\Data\ollama\models (match install script)
)

# If psa-ollama not found, try VOFC-Ollama
$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $svc) {
  $ServiceName = "VOFC-Ollama"
  $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
}
if (-not $svc) {
  Write-Host "[FAIL] No Ollama service found (tried psa-ollama and VOFC-Ollama)." -ForegroundColor Red
  Write-Host "If you run Ollama manually (not as a service), set OLLAMA_MODELS in this session and start the server in this same window:" -ForegroundColor Yellow
  Write-Host '  $env:OLLAMA_MODELS = "D:\PSA_System\data\ollama\models"' -ForegroundColor Gray
  Write-Host "  ollama serve" -ForegroundColor Gray
  Write-Host "Then in another window run: ollama list" -ForegroundColor Gray
  exit 1
}

$nssm = (Get-Command nssm.exe -ErrorAction SilentlyContinue).Source
if (-not $nssm) {
  Write-Host "[FAIL] nssm.exe not in PATH. Install NSSM or set the service env manually." -ForegroundColor Red
  exit 1
}

# Match install_psa_ollama_service.ps1: use PSA_SYSTEM_ROOT, Services\ollama, Data\ollama\models
$PSA_SYSTEM_ROOT = [Environment]::GetEnvironmentVariable("PSA_SYSTEM_ROOT", "Machine")
if (-not $PSA_SYSTEM_ROOT) { $PSA_SYSTEM_ROOT = [Environment]::GetEnvironmentVariable("PSA_SYSTEM_ROOT", "User") }
if (-not $PSA_SYSTEM_ROOT) { $PSA_SYSTEM_ROOT = "D:\PSA_System" }

# Current NSSM paths (so you can verify)
$curDir = & $nssm get $ServiceName AppDirectory 2>$null
$curEnv = & $nssm get $ServiceName AppEnvironmentExtra 2>$null
Write-Host "[Ollama] PSA_SYSTEM_ROOT (resolved): $PSA_SYSTEM_ROOT" -ForegroundColor Gray
Write-Host "[Ollama] NSSM AppDirectory (current): $curDir" -ForegroundColor Gray
if ($curEnv) { Write-Host "[Ollama] NSSM AppEnvironmentExtra (current): $curEnv" -ForegroundColor Gray }

# Startup directory: same as install script (Services\ollama)
$startupDir = Join-Path $PSA_SYSTEM_ROOT "Services\ollama"
New-Item -ItemType Directory -Force -Path $startupDir | Out-Null
Write-Host "[Ollama] Setting AppDirectory to: $startupDir" -ForegroundColor Cyan
& $nssm set $ServiceName AppDirectory $startupDir

# Models path: same as install script (Data\ollama\models) unless overridden
if (-not $ModelsPath -or -not [System.IO.Path]::IsPathRooted($ModelsPath)) {
  $ModelsPath = Join-Path $PSA_SYSTEM_ROOT "Data\ollama\models"
}
$ModelsPath = $ModelsPath -replace "\\+$", ""

if (-not (Test-Path -LiteralPath $ModelsPath -PathType Container)) {
  Write-Host "[WARN] Models path does not exist: $ModelsPath" -ForegroundColor Yellow
}

Write-Host "[Ollama] Setting OLLAMA_MODELS on service '$ServiceName' to: $ModelsPath" -ForegroundColor Cyan
& $nssm set $ServiceName AppEnvironmentExtra `
  "PSA_SYSTEM_ROOT=$PSA_SYSTEM_ROOT" `
  "OLLAMA_MODELS=$ModelsPath" `
  "OLLAMA_HOST=127.0.0.1:11434"

Write-Host "[Ollama] Restarting $ServiceName..." -ForegroundColor Cyan
sc.exe stop $ServiceName | Out-Null
Start-Sleep -Seconds 3
sc.exe start $ServiceName | Out-Null
Start-Sleep -Seconds 2

Write-Host "[Ollama] Done. Run: ollama list" -ForegroundColor Green
ollama list
