# Export sample DOCX from repo root. Uses ADA/report template.docx and data/temp/reporter-run.
# Usage: from asset-dependency-tool, run: .\tools\export_sample.ps1
# Optional: $env:ADA_REPORTER_DEBUG = "1" for step-by-step logging.
$ErrorActionPreference = "Stop"
$root = (Get-Item $PSScriptRoot).Parent.FullName
$templatePath = Join-Path $root "ADA\report template.docx"
$workDir = Join-Path $root "data\temp\reporter-run"
if (-not (Test-Path $templatePath)) {
    Write-Error "Template not found: $templatePath"
    exit 1
}
New-Item -ItemType Directory -Force -Path $workDir | Out-Null
$env:WORK_DIR = $workDir
$env:TEMPLATE_PATH = $templatePath
$payload = @'
{"assessment":{"asset":{"psa_cell":"555-000-0000"},"categories":{"ELECTRIC_POWER":{"requires_service":true,"time_to_impact_hours":24,"loss_fraction_no_backup":0.5,"has_backup_any":true,"backup_duration_hours":48,"loss_fraction_with_backup":0.1,"recovery_time_hours":12},"COMMUNICATIONS":{"requires_service":false},"INFORMATION_TECHNOLOGY":{"requires_service":false},"WATER":{"requires_service":false},"WASTEWATER":{"requires_service":false},"CRITICAL_PRODUCTS":{}}},"vofc_collection":{"items":[]}}
'@
$venvPython = Join-Path $root ".venv-reporter\Scripts\python.exe"
$mainPy = Join-Path $root "apps\reporter\main.py"
if (-not (Test-Path $venvPython)) { Write-Error "Venv not found: $venvPython"; exit 1 }
$payload | & $venvPython $mainPy
$outPath = Join-Path $workDir "output.docx"
if (Test-Path $outPath) { Write-Host "Output: $outPath" } else { exit 1 }
