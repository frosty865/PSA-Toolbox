# S2) Anchor scan: required Annex anchors; no legacy anchors in template.
# Output: tools\validation\out\anchor_report.md | Exit: 0 = pass, 1 = fail
param([string]$RepoRoot, [string]$TemplatePath = "ADA\report template.docx")
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "_ValidationCommon.ps1")
$repoRoot = Get-ValidationRepoRoot -FromScriptRoot $PSScriptRoot -Override $RepoRoot
$templateFull = Join-Path $repoRoot $TemplatePath
$outDir = Ensure-ValidationOutDir -RepoRoot $repoRoot
$reportPath = Join-Path $outDir "anchor_report.md"

$requiredAnnex = @(
    "[[TABLE_DEPENDENCY_SUMMARY]]", "[[STRUCTURAL_PROFILE_SUMMARY]]", "[[VULNERABILITY_COUNT_SUMMARY]]",
    "[[VULNERABILITY_BLOCKS]]", "[[CROSS_INFRA_ANALYSIS]]"
)
$legacyPatterns = @(
    "TABLE_SUMMARY", "TABLE_VOFC", "DEP_SUMMARY_TABLE", "VULN_NARRATIVE",
    "VISUALIZATION_START", "EXECUTIVE_SUMMARY_START", "EXEC_SUMMARY", "APPENDIX_INDEX",
    "INFRA_ENERGY", "INFRA_COMMS", "INFRA_IT", "INFRA_WATER", "INFRA_WASTEWATER"
)

function Get-AnchorsFromDocx {
    param([string]$DocxPath)
    $xml = Read-DocxZipEntry -DocxPath $DocxPath -EntryName "word/document.xml"
    if (-not $xml) { return $null }
    [regex]::Matches($xml, '\[\[([^\]]+)\]\]') | ForEach-Object { "[[$($_.Groups[1].Value)]]" }
}

$report = @("# Anchor scan report", "Template: $templateFull", "")
$exitCode = 0

if (-not (Test-Path $templateFull)) {
    $report += "ERROR: Template not found."
    Write-ValidationReport -Path $reportPath -Lines $report
    exit 1
}

$foundAnchors = @(Get-AnchorsFromDocx $templateFull)
if (-not $foundAnchors) {
    $report += "ERROR: Could not read anchors from DOCX (invalid or missing word/document.xml)."
    Write-ValidationReport -Path $reportPath -Lines $report
    exit 1
}

$countByAnchor = @{}
foreach ($a in $foundAnchors) { $countByAnchor[$a] = ($countByAnchor[$a] + 1) }

$report += "## Required Annex anchors (exactly once each)"
foreach ($req in $requiredAnnex) {
    $c = $countByAnchor[$req]
    if ($c -eq 1) { $report += "- [OK] $req" }
    elseif ($c -gt 1) { $report += "- [FAIL] $req (count=$c, expected 1)"; $exitCode = 1 }
    else { $report += "- [MISSING] $req"; $exitCode = 1 }
}

$report += ""; $report += "## Legacy anchors (must not appear in template)"
$legacyFound = @()
foreach ($a in $foundAnchors) {
    $inner = $a -replace '^\[\[|\]\]$', ''
    foreach ($leg in $legacyPatterns) {
        if ($inner -eq $leg -or $inner -like "${leg}*") { $legacyFound += $a; $exitCode = 1; break }
    }
}
if ($legacyFound.Count -eq 0) { $report += "None found. OK." }
else { $report += "Found (remove from template):"; $legacyFound | Sort-Object -Unique | ForEach-Object { $report += "- $_" } }

$report += ""; $report += "## All anchors in template (for reference)"
$countByAnchor.GetEnumerator() | Sort-Object Name | ForEach-Object { $report += "- $($_.Key): $($_.Value)" }
$report += ""; $report += "---"; $report += "Exit: $(if ($exitCode -eq 0) { 'PASS' } else { 'FAIL' })"
Write-ValidationReport -Path $reportPath -Lines $report
exit $exitCode
