# PSA System - Verify No Legacy Virtual Environments
# Guards against venv directories in wrong locations
#
# This script fails if it finds:
#   - venv\ directory in repo root
#   - .venv\ directory in repo root
#   - Scripts\python.exe in repo root (Windows venv artifact)
#
# Exception: venvs under D:\PSA_System\Dependencies\python\venvs\ are allowed

param(
    [string]$RepoRoot = $PSScriptRoot + "\.."
)

$ErrorActionPreference = "Stop"

# Resolve repo root
$RepoRoot = Resolve-Path $RepoRoot -ErrorAction Stop

# PSA System root
$PSASystemRoot = $env:PSA_SYSTEM_ROOT
if ([string]::IsNullOrEmpty($PSASystemRoot)) {
    $PSASystemRoot = "D:\PSA_System"
}

# Allowed venv locations (absolute paths)
$AllowedVenvRoot = Join-Path $PSASystemRoot "Dependencies\python\venvs"
$AllowedVenvRoot = Resolve-Path $AllowedVenvRoot -ErrorAction SilentlyContinue

$Errors = @()

# Check for venv\ in repo root
$VenvPath = Join-Path $RepoRoot "venv"
if (Test-Path $VenvPath) {
    $Errors += "Found venv\ directory at: $VenvPath (should be under $AllowedVenvRoot)"
}

# Check for .venv\ in repo root
$DotVenvPath = Join-Path $RepoRoot ".venv"
if (Test-Path $DotVenvPath) {
    $Errors += "Found .venv\ directory at: $DotVenvPath (should be under $AllowedVenvRoot)"
}

# Check for Scripts\python.exe in repo root (Windows venv artifact)
$ScriptsPython = Join-Path $RepoRoot "Scripts\python.exe"
if (Test-Path $ScriptsPython) {
    $Errors += "Found Scripts\python.exe at: $ScriptsPython (venv artifact in wrong location)"
}

# Check for bin\python in repo root (Unix venv artifact)
$BinPython = Join-Path $RepoRoot "bin\python"
if (Test-Path $BinPython) {
    $Errors += "Found bin\python at: $BinPython (venv artifact in wrong location)"
}

# Report results
if ($Errors.Count -gt 0) {
    Write-Host "ERROR: Found legacy virtual environments in wrong locations:" -ForegroundColor Red
    Write-Host ""
    foreach ($error in $Errors) {
        Write-Host "  - $error" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "All Python virtual environments must be under:" -ForegroundColor Yellow
    Write-Host "  $AllowedVenvRoot" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To create venvs in the correct location, run:" -ForegroundColor Yellow
    Write-Host "  D:\PSA_System\scripts\python\create_venv.ps1 -ServiceName processor" -ForegroundColor Cyan
    Write-Host "  D:\PSA_System\scripts\python\create_venv.ps1 -ServiceName engine" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To remove legacy venvs, delete:" -ForegroundColor Yellow
    foreach ($error in $Errors) {
        $path = $error -replace ".*Found (.+?) at: (.+?) \(.*", '$2'
        Write-Host "  $path" -ForegroundColor Gray
    }
    exit 1
} else {
    Write-Host "✓ No legacy virtual environments found in wrong locations" -ForegroundColor Green
    exit 0
}
