# Release smoke test: export pipeline, purge behavior.
# Run from repo root: .\scripts\tests\release_smoke.ps1

$ErrorActionPreference = "Stop"
# Script is at scripts/tests/release_smoke.ps1 -> repo root is 2 levels up from script dir
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
Set-Location $RepoRoot

Write-Host "Release smoke: repo root $RepoRoot"

# 1) Export smoke (internal harness: runExportToDocx, then verify_output.py)
$DataTemp = Join-Path $RepoRoot "data\temp"
if (Test-Path $DataTemp) {
    Get-ChildItem $DataTemp -Recurse | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}
Set-Location (Join-Path $RepoRoot "apps\web")
$exportResult = pnpm run exportSmoke 2>&1
Set-Location $RepoRoot
if ($LASTEXITCODE -ne 0) {
    Write-Error "Export smoke failed: $exportResult"
    exit 1
}
Write-Host "Export smoke: OK"

# 2) Temp folder empty after export
Start-Sleep -Seconds 1
$leftover = Get-ChildItem $DataTemp -ErrorAction SilentlyContinue
if ($leftover) {
    Write-Error "data/temp not empty after export: $($leftover.Count) items"
    exit 1
}
Write-Host "Temp folder empty: OK"

Write-Host "Release smoke: all checks passed."
