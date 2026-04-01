# S1) Find duplicate implementations by keyword signatures.
# Output: tools\validation\out\duplicates_report.md | Exit: 0 = report written; 1 = script error
param([string]$RepoRoot)
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "_ValidationCommon.ps1")
$repoRoot = Get-ValidationRepoRoot -FromScriptRoot $PSScriptRoot -Override $RepoRoot
$outDir = Ensure-ValidationOutDir -RepoRoot $repoRoot
$reportPath = Join-Path $outDir "duplicates_report.md"

$keywords = @("VULNERABILITY_BLOCKS", "computeSeverity", "DriverCategory", "anchor", "template.docx")
$extensions = @(".ts", ".tsx", ".js", ".py", ".md")
$files = Get-RepoFilesExcludingBuild -RepoRoot $repoRoot -IncludeExtensions $extensions

$report = @("# Duplicates report (keyword signatures)", "Repo: $repoRoot", "")
$rootLen = $repoRoot.Length + 1

foreach ($kw in $keywords) {
    $report += "## Keyword: ``$kw``"
    $hits = @()
    foreach ($f in $files) {
        try {
            $content = Get-Content -Path $f.FullName -Raw -ErrorAction SilentlyContinue
            if (-not $content -or $content -notmatch [regex]::Escape($kw)) { continue }
            $rel = $f.FullName.Substring($rootLen)
            $count = ([regex]::Matches($content, [regex]::Escape($kw))).Count
            $hits += [pscustomobject]@{ RelPath = $rel; Count = $count }
        } catch { continue }
    }
    if ($hits.Count -eq 0) { $report += "No matches." }
    else {
        $report += "| File | Occurrences |"; $report += "|------|-------------|"
        foreach ($h in $hits) { $report += "| $($h.RelPath) | $($h.Count) |" }
    }
    $report += ""
}
$report += "---"; $report += "Review for single source of truth: one canonical implementation per concept."
Write-ValidationReport -Path $reportPath -Lines $report
exit 0
