# Build reporter.exe with PyInstaller (no Python required on target).
# Run from repo root or apps/reporter. Creates apps/reporter/dist/reporter.exe.

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Use repo root for venv to avoid nesting (optional; can use system Python)
$RepoRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
$VenvPath = Join-Path $RepoRoot ".venv-reporter"
if (-not (Test-Path $VenvPath)) {
    Write-Host "Creating venv at $VenvPath"
    python -m venv $VenvPath
}
& (Join-Path $VenvPath "Scripts\Activate.ps1")

pip install -q -r requirements.txt
pip install -q pyinstaller

Remove-Item -Recurse -Force dist, build -ErrorAction SilentlyContinue
pyinstaller reporter.spec

if (-not (Test-Path "dist\reporter.exe")) {
    Write-Error "Build failed: dist\reporter.exe not found"
    exit 1
}
Write-Host "Built: dist\reporter.exe"
