# Pilot check: run tests and optional validation. Use before test-launch.
# Usage: from asset-dependency-tool, run: .\tools\pilot_check.ps1
# Optional: .\tools\pilot_check.ps1 -Validation to also run anchor_scan, style_scan, safe_scan.
$ErrorActionPreference = "Stop"
param([switch]$Validation)
$root = (Get-Item $PSScriptRoot).Parent.FullName
Set-Location $root
Write-Host "Running pnpm -r test..."
& pnpm -r test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Running pnpm -r build..."
& pnpm -r build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if ($Validation) {
    $validationDir = Join-Path $root "tools\validation"
    if (Test-Path (Join-Path $validationDir "anchor_scan.ps1")) {
        & (Join-Path $validationDir "anchor_scan.ps1")
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    if (Test-Path (Join-Path $validationDir "style_scan.ps1")) {
        & (Join-Path $validationDir "style_scan.ps1")
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    if (Test-Path (Join-Path $validationDir "safe_scan.ps1")) {
        & (Join-Path $validationDir "safe_scan.ps1")
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
}
Write-Host "Pilot check complete."
