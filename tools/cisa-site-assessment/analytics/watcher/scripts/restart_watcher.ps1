# Restart Pipeline Watcher (Windows)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Restarting Pipeline Watcher..." -ForegroundColor Yellow
& "$scriptDir\stop_watcher.ps1"
Start-Sleep -Seconds 2
& "$scriptDir\start_watcher.ps1"

