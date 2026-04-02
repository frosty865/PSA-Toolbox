<#
.SYNOPSIS
  Update Ollama from the command line (for custom/installer-based installs).
.DESCRIPTION
  Stops the NSSM Ollama service, downloads the latest OllamaSetup.exe, runs it silently, then starts the service again.
  Use when you have a custom install (e.g. NSSM) and want to upgrade without the GUI.
.PARAMETER ServiceName
  NSSM service name to stop/start (default: VOFC-Ollama). Use "" to skip service stop/start.
.EXAMPLE
  pwsh -ExecutionPolicy Bypass -File tools\ollama\update_ollama.ps1
.EXAMPLE
  pwsh -ExecutionPolicy Bypass -File tools\ollama\update_ollama.ps1 -ServiceName psa-ollama
#>
param(
  [string]$ServiceName = "VOFC-Ollama"
)

$url = "https://ollama.com/download/OllamaSetup.exe"
$exe = Join-Path $env:TEMP "OllamaSetup.exe"

if ($ServiceName) {
  $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if ($svc) {
    Write-Host "[Update] Stopping $ServiceName..." -ForegroundColor Cyan
    sc.exe stop $ServiceName | Out-Null
    Start-Sleep -Seconds 3
  } else {
    Write-Host "[Update] Service '$ServiceName' not found; skipping stop. Stop Ollama manually if needed." -ForegroundColor Yellow
  }
}

Write-Host "[Update] Downloading latest OllamaSetup.exe..." -ForegroundColor Cyan
try {
  Invoke-WebRequest -Uri $url -OutFile $exe -UseBasicParsing
} catch {
  Write-Host "[FAIL] Download failed: $_" -ForegroundColor Red
  exit 1
}

Write-Host "[Update] Running installer (silent)..." -ForegroundColor Cyan
Start-Process -FilePath $exe -ArgumentList "/SP-", "/VERYSILENT", "/NORESTART" -Wait

if ($ServiceName) {
  $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if ($svc) {
    Write-Host "[Update] Starting $ServiceName..." -ForegroundColor Cyan
    sc.exe start $ServiceName | Out-Null
  }
}

Write-Host "[Update] Done. Check: ollama --version" -ForegroundColor Green
