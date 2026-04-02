# Complete migration script: Move Tech_Sources and update all references
# Run as Administrator

param(
    [string]$SourcePath = "D:\PSA_System\Tech_Sources",
    [string]$DestPath = "D:\PSA_System\psa_rebuild\psaback\Tech_Sources",
    [string]$PsabackRoot = "D:\PSA_System\psa_rebuild\psaback"
)

$separator = "=" * 70
Write-Host $separator
Write-Host "Tech_Sources Complete Migration"
Write-Host $separator
Write-Host ""

# Step 1: Move directory
Write-Host "STEP 1: Moving Tech_Sources directory..." -ForegroundColor Cyan
if (Test-Path $SourcePath) {
    if (Test-Path $DestPath) {
        Write-Host "WARNING: Destination already exists: $DestPath" -ForegroundColor Yellow
        $response = Read-Host "Overwrite? (y/n)"
        if ($response -ne "y") {
            Write-Host "Migration cancelled"
            exit 0
        }
        Remove-Item -Path $DestPath -Recurse -Force
    }
    
    $destParent = Split-Path -Parent $DestPath
    if (-not (Test-Path $destParent)) {
        New-Item -ItemType Directory -Path $destParent -Force | Out-Null
    }
    
    Move-Item -Path $SourcePath -Destination $DestPath -Force
    Write-Host "✓ Tech_Sources moved to: $DestPath" -ForegroundColor Green
} else {
    Write-Host "Source not found: $SourcePath (may already be moved)" -ForegroundColor Yellow
}

Write-Host ""

# Step 2: Update psaback code references
Write-Host "STEP 2: Updating psaback code references..." -ForegroundColor Cyan

if (-not (Test-Path $PsabackRoot)) {
    Write-Host "ERROR: psaback directory not found: $PsabackRoot" -ForegroundColor Red
    exit 1
}

$oldPath = "D:\PSA_System\Tech_Sources"
$newPath = "D:\PSA_System\psa_rebuild\psaback\Tech_Sources"

$filesUpdated = 0
$patterns = @("*.py", "*.ps1", "*.bat", "*.env", "*.json")

foreach ($pattern in $patterns) {
    Get-ChildItem -Path $PsabackRoot -Recurse -Include $pattern -Exclude "__pycache__", "node_modules", "venv", ".git" -ErrorAction SilentlyContinue | 
        ForEach-Object {
            $file = $_
            try {
                $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
                if ($content -and $content -match [regex]::Escape($oldPath)) {
                    $newContent = $content -replace [regex]::Escape($oldPath), $newPath
                    Set-Content -Path $file.FullName -Value $newContent -NoNewline
                    Write-Host "  Updated: $($file.FullName)" -ForegroundColor Green
                    $filesUpdated++
                }
            } catch {
                # Skip files that can't be read
            }
        }
}

Write-Host "✓ Updated $filesUpdated files" -ForegroundColor Green
Write-Host ""

# Step 3: Summary
Write-Host $separator
Write-Host "Migration Complete!"
Write-Host $separator
Write-Host ""
Write-Host "Key files updated:" -ForegroundColor Cyan
Write-Host "  - services/pipeline_watcher.py" -ForegroundColor White
Write-Host "  - api/coverage_analysis.py" -ForegroundColor White
Write-Host "  - services/phase2_file_watcher.py" -ForegroundColor White
Write-Host "  - start_watcher.ps1" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Verify Tech_Sources is at: $DestPath" -ForegroundColor White
Write-Host "  2. Restart the watcher service" -ForegroundColor White
Write-Host "  3. Test with a sample document" -ForegroundColor White
Write-Host ""
Write-Host "Verify changes:" -ForegroundColor Cyan
Write-Host "  cd $PsabackRoot" -ForegroundColor White
Write-Host "  findstr /s /i `"Tech_Sources`" *.py *.ps1" -ForegroundColor White
