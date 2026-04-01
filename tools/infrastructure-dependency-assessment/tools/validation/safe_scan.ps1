# S4) Repo-wide scan for "SAFE" (case-insensitive); exclude archive. Exit non-zero if found.
# Output: tools\validation\out\safe_report.md
param([string]$RepoRoot)
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "_ValidationCommon.ps1")
$repoRoot = Get-ValidationRepoRoot -FromScriptRoot $PSScriptRoot -Override $RepoRoot
$outDir = Ensure-ValidationOutDir -RepoRoot $repoRoot
$reportPath = Join-Path $outDir "safe_report.md"

$files = Get-RepoFilesExcludingBuild -RepoRoot $repoRoot | Where-Object { $_.Extension -ne ".docx" }
$hits = @()
foreach ($f in $files) {
    try {
        $content = Get-Content -Path $f.FullName -Raw -ErrorAction SilentlyContinue
    } catch { continue }
    if (-not $content -or $content -notmatch "SAFE") { continue }
    $rootLen = $repoRoot.Length + 1
    $relPath = $f.FullName.Substring($rootLen)
    $lineNum = 0
    foreach ($line in ($content -split "`n")) {
        $lineNum++
        if ($line -match "SAFE") {
            $snippet = $line.Trim()
            if ($snippet.Length -gt 120) { $snippet = $snippet.Substring(0, 117) + "..." }
            $hits += [pscustomobject]@{ File = $relPath; Line = $lineNum; Text = $snippet }
        }
    }
}

$report = @(
    "# SAFE scan report",
    "Repo: $repoRoot",
    "Excluded: $($script:ValidationExcludeDirs -join ', ')",
    ""
)
if ($hits.Count -eq 0) {
    $report += "No occurrences of 'SAFE' found in active paths. PASS."
    Write-ValidationReport -Path $reportPath -Lines $report
    exit 0
}
$report += "Found $($hits.Count) occurrence(s) of 'SAFE' (case-insensitive). FAIL."
$report += ""; $report += "| File | Line | Snippet |"; $report += "|------|------|--------|"
foreach ($h in $hits) {
    $snippet = ($h.Text -replace "\|", " " -replace "`r", "").Trim()
    if ($snippet.Length -gt 80) { $snippet = $snippet.Substring(0, 77) + "..." }
    $report += "| $($h.File) | $($h.Line) | $snippet |"
}
$report += ""; $report += "---"; $report += "Exit: FAIL (remove or replace SAFE from active code paths)"
Write-ValidationReport -Path $reportPath -Lines $report
exit 1
