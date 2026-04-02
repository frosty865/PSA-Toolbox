# PSA System - Router Service Runner
# Runs the deterministic router service

param(
    [string]$BaseDir = "",
    [switch]$Once = $false,
    [int]$PollInterval = 5
)

$ErrorActionPreference = "Stop"

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir

# Determine Python executable
$PythonPath = $null

# Try PSA System venv (processor service)
$VenvPath = "D:\PSA_System\Dependencies\python\venvs\processor\Scripts\python.exe"
if (Test-Path $VenvPath) {
    $PythonPath = $VenvPath
} else {
    # Fallback to system Python
    $PythonPath = "python"
}

# Router service path
$RouterService = Join-Path $RepoRoot "services\router\router_service.py"

if (-not (Test-Path $RouterService)) {
    Write-Host "ERROR: Router service not found: $RouterService" -ForegroundColor Red
    exit 1
}

# Build arguments
$Args = @()

if ($BaseDir) {
    $Args += "--base-dir", $BaseDir
}

if ($Once) {
    $Args += "--once"
}

if ($PollInterval -ne 5) {
    $Args += "--poll-interval", $PollInterval
}

Write-Host "PSA System - Router Service" -ForegroundColor Cyan
Write-Host "Python: $PythonPath" -ForegroundColor Gray
Write-Host "Service: $RouterService" -ForegroundColor Gray
Write-Host ""

# Run router service
& $PythonPath $RouterService $Args

if ($LASTEXITCODE -ne 0) {
    Write-Host "Router service exited with error code: $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}
