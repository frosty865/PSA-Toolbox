<#
.SYNOPSIS
  Restart the NSSM-run Ollama service (after you set GPU env in NSSM).
.DESCRIPTION
  Stops and starts the given service so env changes in NSSM take effect.
  Default service name is VOFC-Ollama; use -ServiceName if you use psa-ollama or another name.
.PARAMETER ServiceName
  NSSM service name (default: VOFC-Ollama).
.EXAMPLE
  pwsh -ExecutionPolicy Bypass -File tools\ollama\restart_ollama_service.ps1
.EXAMPLE
  pwsh -ExecutionPolicy Bypass -File tools\ollama\restart_ollama_service.ps1 -ServiceName psa-ollama
#>
param(
  [string]$ServiceName = "VOFC-Ollama"
)

$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $svc) {
  Write-Host "[FAIL] Service '$ServiceName' not found. Use -ServiceName if different (e.g. psa-ollama)." -ForegroundColor Red
  exit 1
}

Write-Host "[Ollama] Stopping $ServiceName..." -ForegroundColor Cyan
sc.exe stop $ServiceName
Start-Sleep -Seconds 3
Write-Host "[Ollama] Starting $ServiceName..." -ForegroundColor Cyan
sc.exe start $ServiceName
Write-Host "[Ollama] Done. Check logs for 'initial_count=1' and 'library=cuda' (e.g. NSSM stdout/stderr or Event Viewer)." -ForegroundColor Green
