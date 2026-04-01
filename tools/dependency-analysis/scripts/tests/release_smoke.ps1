# Release smoke test: reporter.exe, export pipeline, purge behavior.
# Run from repo root: .\scripts\tests\release_smoke.ps1

$ErrorActionPreference = "Stop"
# Script is at scripts/tests/release_smoke.ps1 -> repo root is 2 levels up from script dir
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
Set-Location $RepoRoot

Write-Host "Release smoke: repo root $RepoRoot"

# 1) Reporter exe exists and runs without Python
$ReporterExe = Join-Path $RepoRoot "apps\reporter\dist\reporter.exe"
if (-not (Test-Path $ReporterExe)) {
    Write-Host "Building reporter.exe..."
    Set-Location (Join-Path $RepoRoot "apps\reporter")
    & .\build.ps1
    Set-Location $RepoRoot
}
if (-not (Test-Path $ReporterExe)) {
    Write-Error "reporter.exe not found at $ReporterExe"
    exit 1
}

$guid = [System.Guid]::NewGuid().ToString("n").Substring(0, 8)
$WorkDir = Join-Path ([System.IO.Path]::GetTempPath()) "PSA-IDA-Smoke-$guid"
New-Item -ItemType Directory -Force $WorkDir | Out-Null
$TemplatePath = Join-Path $RepoRoot "assets\templates\Asset Dependency Assessment Report_BLANK.docx"
$MinimalJson = '{"meta":{"tool_version":"0.1.0","template_version":"v1","created_at_iso":"2025-01-01T00:00:00Z"},"asset":{"asset_name":"Smoke","visit_date_iso":"2025-01-01","location":"","assessor":""},"categories":{"ELECTRIC_POWER":{"requires_service":true,"time_to_impact_hours":24,"loss_fraction_no_backup":0.5,"has_backup":true,"backup_duration_hours":12,"loss_fraction_with_backup":0.2,"recovery_time_hours":48}}}'

$env:WORK_DIR = $WorkDir
$env:TEMPLATE_PATH = $TemplatePath
$out = $MinimalJson | & $ReporterExe 2>&1

if ($LASTEXITCODE -ne 0) {
    Remove-Item -Recurse -Force $WorkDir -ErrorAction SilentlyContinue
    Write-Error "reporter.exe failed: $out"
    exit 1
}
$outPath = $out.ToString().Trim()
if (-not $outPath -or -not (Test-Path $outPath)) {
    Remove-Item -Recurse -Force $WorkDir -ErrorAction SilentlyContinue
    Write-Error "reporter.exe did not produce output at: $outPath"
    exit 1
}
Remove-Item -Recurse -Force $WorkDir -ErrorAction SilentlyContinue
Write-Host "Reporter exe: OK (output was $outPath)"

# 2) Export smoke (internal harness: runExportToDocx, then verify_output.py)
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

# 3) Temp folder empty after export
Start-Sleep -Seconds 1
$leftover = Get-ChildItem $DataTemp -ErrorAction SilentlyContinue
if ($leftover) {
    Write-Error "data/temp not empty after export: $($leftover.Count) items"
    exit 1
}
Write-Host "Temp folder empty: OK"

Write-Host "Release smoke: all checks passed."
