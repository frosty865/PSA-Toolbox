# Remove nested psa_engine folder from psaback
# After verifying all code references point to sibling psa_engine

$ErrorActionPreference = "Stop"

$NestedEngine = "D:\PSA_System\psa_rebuild\psaback\psa_engine"
$SiblingEngine = "D:\PSA_System\psa_rebuild\psa_engine"
$separator = '=' * 70

Write-Host $separator -ForegroundColor Cyan
Write-Host "Remove Nested psa_engine Folder" -ForegroundColor Cyan
Write-Host $separator -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $NestedEngine)) {
    Write-Host "Nested psa_engine folder not found - already removed" -ForegroundColor Green
    exit 0
}

if (-not (Test-Path $SiblingEngine)) {
    Write-Host "ERROR: Sibling psa_engine not found at: $SiblingEngine" -ForegroundColor Red
    Write-Host "Cannot remove nested folder - sibling must exist first" -ForegroundColor Red
    exit 1
}

Write-Host "Nested folder: $NestedEngine" -ForegroundColor Yellow
Write-Host "Sibling folder: $SiblingEngine" -ForegroundColor Green
Write-Host ""

# Count items
$nestedItems = (Get-ChildItem $NestedEngine -Recurse -File | Measure-Object).Count
Write-Host "Nested folder contains: $nestedItems files" -ForegroundColor Cyan
Write-Host ""

# Verify code references point to sibling
Write-Host "Verifying code references..." -ForegroundColor Cyan
$badRefs = Get-ChildItem -Path "D:\PSA_System\psa_rebuild\psaback" -Recurse -Include *.py | 
    Select-String -Pattern 'parent\s*/\s*["\']psa_engine["\']' -CaseSensitive:$false

if ($badRefs) {
    Write-Host "WARNING: Found references that might use nested path:" -ForegroundColor Yellow
    $badRefs | ForEach-Object { Write-Host "  $($_.Path):$($_.LineNumber)" -ForegroundColor Yellow }
    Write-Host ""
    $response = Read-Host "Continue anyway? (y/n)"
    if ($response -ne "y") {
        Write-Host "Aborted" -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "No problematic references found" -ForegroundColor Green
}

Write-Host ""
$response = Read-Host "Remove nested psa_engine folder? (y/n)"
if ($response -eq "y") {
    Remove-Item -Path $NestedEngine -Recurse -Force
    Write-Host "Removed nested psa_engine folder" -ForegroundColor Green
} else {
    Write-Host "Aborted" -ForegroundColor Yellow
}

Write-Host ""
Write-Host $separator -ForegroundColor Cyan
