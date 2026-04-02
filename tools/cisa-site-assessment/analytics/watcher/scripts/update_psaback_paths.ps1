# Update all Tech_Sources paths in psaback to point to psaback/Tech_Sources
# Run from psaback directory

param(
    [string]$PsabackRoot = "D:\PSA_System\psa_rebuild\psaback",
    [string]$OldPath = "D:\PSA_System\Tech_Sources",
    [string]$NewPath = "D:\PSA_System\psa_rebuild\psaback\Tech_Sources"
)

Write-Host "=" * 60
Write-Host "Update psaback Tech_Sources Paths"
Write-Host "=" * 60
Write-Host "Old path: $OldPath"
Write-Host "New path: $NewPath"
Write-Host ""

if (-not (Test-Path $PsabackRoot)) {
    Write-Host "ERROR: psaback directory not found: $PsabackRoot" -ForegroundColor Red
    exit 1
}

$filesUpdated = 0
$filesSkipped = 0

# Files to update
$filePatterns = @("*.py", "*.ps1", "*.bat", "*.env", "*.json", "*.yaml", "*.yml")

foreach ($pattern in $filePatterns) {
    Get-ChildItem -Path $PsabackRoot -Recurse -Include $pattern -Exclude "__pycache__", "node_modules", "venv", ".git" | 
        ForEach-Object {
            $file = $_
            try {
                $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
                if ($content -and $content -match [regex]::Escape($OldPath)) {
                    $newContent = $content -replace [regex]::Escape($OldPath), $NewPath
                    Set-Content -Path $file.FullName -Value $newContent -NoNewline
                    Write-Host "Updated: $($file.FullName)" -ForegroundColor Green
                    $filesUpdated++
                }
            } catch {
                Write-Host "Skipped (error): $($file.FullName)" -ForegroundColor Yellow
                $filesSkipped++
            }
        }
}

Write-Host ""
Write-Host "=" * 60
Write-Host "Update Complete"
Write-Host "=" * 60
Write-Host "Files updated: $filesUpdated" -ForegroundColor Green
Write-Host "Files skipped: $filesSkipped" -ForegroundColor Yellow
Write-Host ""
Write-Host "Key files that should have been updated:" -ForegroundColor Cyan
Write-Host "  - services/pipeline_watcher.py" -ForegroundColor White
Write-Host "  - api/coverage_analysis.py" -ForegroundColor White
Write-Host "  - services/phase2_file_watcher.py" -ForegroundColor White
Write-Host "  - start_watcher.ps1" -ForegroundColor White
Write-Host ""
Write-Host "Verify changes:" -ForegroundColor Yellow
Write-Host "  cd $PsabackRoot" -ForegroundColor White
Write-Host "  findstr /s /i `"Tech_Sources`" *.py *.ps1 *.env" -ForegroundColor White

