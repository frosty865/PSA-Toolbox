# S3) Style scan: required ADA paragraph styles; note Paragraph vs Character.
# Output: tools\validation\out\style_report.md | Exit: 0 = pass, 1 = fail
param([string]$RepoRoot, [string]$TemplatePath = "ADA\report template.docx")
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "_ValidationCommon.ps1")
$repoRoot = Get-ValidationRepoRoot -FromScriptRoot $PSScriptRoot -Override $RepoRoot
$templateFull = Join-Path $repoRoot $TemplatePath
$outDir = Ensure-ValidationOutDir -RepoRoot $repoRoot
$reportPath = Join-Path $outDir "style_report.md"

$requiredStyles = @(
    "ADA_Vuln_Header", "ADA_Vuln_Severity", "ADA_Vuln_Meta", "ADA_Vuln_Label",
    "ADA_Vuln_Body", "ADA_Vuln_Bullets", "ADA_Vuln_Numbered"
)

function Get-StylesFromDocx {
    param([string]$DocxPath)
    $xml = Read-DocxZipEntry -DocxPath $DocxPath -EntryName "word/styles.xml"
    if (-not $xml) { return @{} }
    $result = @{}
    foreach ($name in $requiredStyles) {
        if ($xml -match ('<w:name\s+w:val="' + [regex]::Escape($name) + '"\s*/>')) {
            $type = "unknown"
            if ($xml -match ('<w:style[^>]*w:styleId="[^"]*"[^>]*w:type="(paragraph|character)"[^>]*>[\s\S]*?<w:name\s+w:val="' + [regex]::Escape($name) + '"')) { $type = $Matches[1] }
            elseif ($xml -match ('<w:style[^>]*>[\s\S]*?<w:name\s+w:val="' + [regex]::Escape($name) + '"[\s\S]*?<w:type\s+w:val="(paragraph|character)"')) { $type = $Matches[1] }
            $result[$name] = $type
        }
    }
    $result
}

$report = @("# Style scan report", "Template: $templateFull", "")
$exitCode = 0

if (-not (Test-Path $templateFull)) {
    $report += "ERROR: Template not found."
    Write-ValidationReport -Path $reportPath -Lines $report
    exit 1
}

$found = Get-StylesFromDocx $templateFull
$report += "## Required ADA styles (Paragraph vs Character)"
foreach ($s in $requiredStyles) {
    if ($found.ContainsKey($s)) {
        $t = $found[$s]
        $note = if ($t -eq "paragraph") { "Paragraph (OK)" } elseif ($t -eq "character") { "Character" } else { "type unknown" }
        $report += "- [OK] $s - $note"
    } else { $report += "- [MISSING] $s"; $exitCode = 1 }
}
$report += ""
$report += "Note: ADA vulnerability block styles should be Paragraph styles. Trailing spaces in style names are not allowed."
$report += "---"; $report += "Exit: $(if ($exitCode -eq 0) { 'PASS' } else { 'FAIL' })"
Write-ValidationReport -Path $reportPath -Lines $report
exit $exitCode
