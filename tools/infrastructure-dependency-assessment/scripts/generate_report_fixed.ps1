# Generate Report-fixed.docx using _dev_with_anchors.docx template.
# Usage:
#   .\generate_report_fixed.ps1
#     Uses minimal payload, writes Report-fixed.docx to repo root data/temp/reporter.
#   Get-Content input.json | .\generate_report_fixed.ps1 -OutputPath .\Report-fixed.docx
#     Uses your JSON (same format as Report-temp.docx input), writes to -OutputPath.
#
# Requires: TEMPLATE_PATH will be set to assets/templates/_dev_with_anchors.docx
#           (or Asset Dependency Assessment Report_BLANK.docx if dev template missing).

param(
    [string]$OutputPath = "",
    [string]$InputJsonPath = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Get-Item $PSScriptRoot).Parent.FullName
$TemplatesDir = Join-Path $RepoRoot "assets\templates"
$DevTemplate = Join-Path $TemplatesDir "_dev_with_anchors.docx"
$BlankTemplate = Join-Path $TemplatesDir "Asset Dependency Assessment Report_BLANK.docx"
$ReporterMain = Join-Path $RepoRoot "apps\reporter\main.py"
$WorkDir = Join-Path $RepoRoot "data\temp\reporter"
$OutDocx = Join-Path $WorkDir "output.docx"

if (-not (Test-Path $ReporterMain)) {
    Write-Error "Reporter not found: $ReporterMain"
}
$TemplatePath = if (Test-Path $DevTemplate) { $DevTemplate } else { $BlankTemplate }
if (-not (Test-Path $TemplatePath)) {
    Write-Error "Template not found: $TemplatePath"
}

New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null
$env:WORK_DIR = $WorkDir
$env:TEMPLATE_PATH = $TemplatePath

$Payload = $null
if ($InputJsonPath -and (Test-Path $InputJsonPath)) {
    $Payload = Get-Content -Raw -Path $InputJsonPath
} else {
    # Minimal payload so all anchors get replaced
    $Payload = @"
{"assessment":{"asset":{"asset_name":"Report-fixed Test","visit_date_iso":"2025-01-15","assessor":"","location":""},"categories":{"ELECTRIC_POWER":{"requires_service":true,"time_to_impact_hours":24,"loss_fraction_no_backup":0.5,"has_backup_any":true,"backup_duration_hours":48,"loss_fraction_with_backup":0.1,"recovery_time_hours":12},"COMMUNICATIONS":{"requires_service":false},"INFORMATION_TECHNOLOGY":{"requires_service":false},"WATER":{"requires_service":false},"WASTEWATER":{"requires_service":false},"CRITICAL_PRODUCTS":{}}},"vofc_collection":{"items":[]}}
"@
}

$Python = if (Test-Path (Join-Path $RepoRoot ".venv-reporter\Scripts\python.exe")) {
    Join-Path $RepoRoot ".venv-reporter\Scripts\python.exe"
} else { "python" }
$Payload | & $Python $ReporterMain
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not (Test-Path $OutDocx)) {
    Write-Error "Reporter did not create output.docx"
}

$Dest = if ($OutputPath) { $OutputPath } else { Join-Path $RepoRoot "Report-fixed.docx" }
Copy-Item -Path $OutDocx -Destination $Dest -Force
Write-Host "Report-fixed.docx written to: $Dest"
# Run parity check
& $Python (Join-Path $RepoRoot "apps\reporter\verify_output.py") $Dest
if ($LASTEXITCODE -ne 0) {
    Write-Warning "verify_output.py reported issues; review $Dest"
}
exit 0
