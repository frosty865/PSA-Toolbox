# PSA System - Intake Wizard Runner
# Runs the intake wizard for human-confirmed metadata entry

param(
    [string]$StagingDir = "",
    [switch]$NoOllama = $false,
    [switch]$Bulk = $false,
    [string[]]$Files = @()
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

# Intake wizard path
$IntakeWizard = Join-Path $RepoRoot "tools\intake\intake_wizard.py"

if (-not (Test-Path $IntakeWizard)) {
    Write-Host "ERROR: Intake wizard not found: $IntakeWizard" -ForegroundColor Red
    exit 1
}

# Build arguments
$Args = @()

if ($StagingDir) {
    $Args += "--staging-dir", $StagingDir
}

if ($NoOllama) {
    $Args += "--no-ollama"
}

if ($Bulk) {
    $Args += "--bulk"
}

foreach ($file in $Files) {
    $Args += $file
}

Write-Host "PSA System - Intake Wizard" -ForegroundColor Cyan
Write-Host "Python: $PythonPath" -ForegroundColor Gray
Write-Host "Wizard: $IntakeWizard" -ForegroundColor Gray
Write-Host ""

# Run intake wizard
& $PythonPath $IntakeWizard $Args

if ($LASTEXITCODE -ne 0) {
    Write-Host "Intake wizard exited with error code: $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}
