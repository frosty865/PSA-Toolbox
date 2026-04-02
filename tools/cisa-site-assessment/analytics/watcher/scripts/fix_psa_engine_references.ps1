# Fix psa_engine path references in psaback
# Updates references from nested psaback/psa_engine to sibling psa_engine

$ErrorActionPreference = "Stop"

$PsabackRoot = "D:\PSA_System\psa_rebuild\psaback"
$PsaEngineRoot = "D:\PSA_System\psa_rebuild\psa_engine"

Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "Fixing psa_engine Path References" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

# Pattern: parent / "psa_engine" or parent.parent / "psa_engine"
# Should become: parent.parent / "psa_engine" (sibling, not nested)

$filesToUpdate = @(
    "api\admin_validation.py",
    "api\coverage_analysis.py",
    "api\sector_subsector_coverage.py",
    "api\v2_assessments.py",
    "api\v2_bootstrap.py",
    "services\validation\forbidden_terms.py",
    "services\document_relevance_service.py",
    "services\pipeline_watcher.py",
    "tools\doctrine\generate_from_subtypes.py",
    "tools\doctrine\seed_from_subtype_doctrine.py",
    "tools\ingest_observed_vulnerabilities.py",
    "tools\seed_canonical_library.py",
    "tools\smoke_test_assessment_loop.py",
    "tools\temp_coverage_calculator.py",
    "app.py"
)

$updatedCount = 0
$skippedCount = 0

foreach ($file in $filesToUpdate) {
    $filePath = Join-Path $PsabackRoot $file
    
    if (-not (Test-Path $filePath)) {
        Write-Host "  SKIP: File not found: $file" -ForegroundColor Yellow
        $skippedCount++
        continue
    }
    
    $content = Get-Content $filePath -Raw
    $originalContent = $content
    
    # Pattern 1: Path(__file__).parent / "psa_engine" -> Path(__file__).parent.parent / "psa_engine"
    # (Files in psaback root need parent.parent to reach sibling psa_engine)
    $content = $content -replace 'Path\(__file__\)\.parent\s*/\s*"psa_engine"', 'Path(__file__).parent.parent / "psa_engine"'
    $content = $content -replace "Path\(__file__\)\.parent\s*/\s*'psa_engine'", "Path(__file__).parent.parent / 'psa_engine'"
    
    # Pattern 2: Path(__file__).parent.parent / "psaback" / "psa_engine" -> Path(__file__).parent.parent / "psa_engine"
    $content = $content -replace 'Path\(__file__\)\.parent\.parent\s*/\s*"psaback"\s*/\s*"psa_engine"', 'Path(__file__).parent.parent / "psa_engine"'
    $content = $content -replace "Path\(__file__\)\.parent\.parent\s*/\s*'psaback'\s*/\s*'psa_engine'", "Path(__file__).parent.parent / 'psa_engine'"
    
    # Pattern 3: parent / "psaback" / "psa_engine" -> parent.parent / "psa_engine"
    $content = $content -replace 'Path\(__file__\)\.parent\s*/\s*"psaback"\s*/\s*"psa_engine"', 'Path(__file__).parent.parent / "psa_engine"'
    $content = $content -replace "Path\(__file__\)\.parent\s*/\s*'psaback'\s*/\s*'psa_engine'", "Path(__file__).parent.parent / 'psa_engine'"
    
    if ($content -ne $originalContent) {
        Set-Content -Path $filePath -Value $content -NoNewline
        Write-Host "  UPDATED: $file" -ForegroundColor Green
        $updatedCount++
    } else {
        Write-Host "  NO CHANGE: $file" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "  Updated: $updatedCount files" -ForegroundColor Green
Write-Host "  Skipped: $skippedCount files" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next step: Remove nested psa_engine folder if all references are fixed" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan

