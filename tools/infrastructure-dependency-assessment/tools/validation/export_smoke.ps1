# S5) Run export for each fixture JSON under ADA\_pilot_fixtures\inputs\; capture logs.
# Output: tools\validation\out\export_smoke_summary.md, out\export_logs\*.log | Exit: 0 = all pass, 1 = fail/skip
param([string]$RepoRoot)
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "_ValidationCommon.ps1")
$repoRoot = Get-ValidationRepoRoot -FromScriptRoot $PSScriptRoot -Override $RepoRoot
$outDir = Ensure-ValidationOutDir -RepoRoot $repoRoot
$logsDir = Join-Path $outDir "export_logs"
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
$summaryPath = Join-Path $outDir "export_smoke_summary.md"

$inputsDir = Join-Path $repoRoot "ADA\_pilot_fixtures\inputs"
$templatePath = Join-Path $repoRoot "ADA\report template.docx"
$venvPython = Join-Path $repoRoot ".venv-reporter\Scripts\python.exe"
$mainPy = Join-Path $repoRoot "apps\reporter\main.py"

if (-not (Test-Path $templatePath)) {
    Write-ValidationReport -Path $summaryPath -Lines @("# Export smoke summary", "ERROR: Template not found: $templatePath")
    exit 1
}
if (-not (Test-Path $venvPython)) {
    Write-ValidationReport -Path $summaryPath -Lines @("# Export smoke summary", "ERROR: Venv Python not found: $venvPython")
    exit 1
}

$jsonFiles = @(Get-ChildItem -Path $inputsDir -Filter "*.json" -ErrorAction SilentlyContinue)
if ($jsonFiles.Count -eq 0) {
    Write-ValidationReport -Path $summaryPath -Lines @("# Export smoke summary", "No fixture JSONs in $inputsDir", "Exit: SKIP")
    exit 1
}

$results = @()
$exitCode = 0
foreach ($jf in $jsonFiles) {
    $workDir = Join-Path $repoRoot "data\temp\export_smoke_$($jf.BaseName)"
    New-Item -ItemType Directory -Force -Path $workDir | Out-Null
    $env:WORK_DIR = $workDir
    $env:TEMPLATE_PATH = $templatePath
    $logPath = Join-Path $logsDir "$($jf.BaseName).log"
    $payload = Get-Content -Raw -Path $jf.FullName
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $venvPython
    $psi.Arguments = "`"$mainPy`""
    $psi.WorkingDirectory = $repoRoot
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $p = [System.Diagnostics.Process]::Start($psi)
    $p.StandardInput.Write($payload)
    $p.StandardInput.Close()
    $outStr = $p.StandardOutput.ReadToEnd()
    $errStr = $p.StandardError.ReadToEnd()
    $p.WaitForExit(120000)
    $logContent = "=== stdout ===`n$outStr`n=== stderr ===`n$errStr"
    $logContent | Set-Content -Path $logPath -Encoding UTF8
    $outDocx = Join-Path $workDir "output.docx"
    if (($p.ExitCode -ne 0) -or -not (Test-Path $outDocx)) { $exitCode = 1 }
    $results += [pscustomobject]@{ Fixture = $jf.Name; ExitCode = $p.ExitCode; OutputDocx = (Test-Path $outDocx); Log = $logPath }
    Remove-Item -Path $workDir -Recurse -Force -ErrorAction SilentlyContinue
}

$report = @("# Export smoke summary", "Fixtures: $inputsDir", "", "| Fixture | Process exit | output.docx | Log |", "|---------|--------------|-------------|-----|")
foreach ($r in $results) { $report += "| $($r.Fixture) | $($r.ExitCode) | $(if ($r.OutputDocx) { 'yes' } else { 'no' }) | $($r.Log) |" }
$report += ""; $report += "---"; $report += "Exit: $(if ($exitCode -eq 0) { 'PASS' } else { 'FAIL' })"
Write-ValidationReport -Path $summaryPath -Lines $report
exit $exitCode
