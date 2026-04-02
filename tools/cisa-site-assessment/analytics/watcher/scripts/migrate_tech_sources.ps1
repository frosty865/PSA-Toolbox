# Migrate Tech_Sources from psa-workspace to psaback
# Run as Administrator for best results

param(
    [string]$SourcePath = "D:\PSA_System\Tech_Sources",
    [string]$DestPath = "D:\PSA_System\psa_rebuild\psaback\Tech_Sources"
)

Write-Host "=" * 60
Write-Host "Tech_Sources Migration Script"
Write-Host "=" * 60
Write-Host "Source: $SourcePath"
Write-Host "Destination: $DestPath"
Write-Host ""

# Check if source exists
if (-not (Test-Path $SourcePath)) {
    Write-Host "ERROR: Source directory does not exist: $SourcePath" -ForegroundColor Red
    exit 1
}

# Check if destination already exists
if (Test-Path $DestPath) {
    Write-Host "WARNING: Destination already exists: $DestPath" -ForegroundColor Yellow
    $response = Read-Host "Overwrite? (y/n)"
    if ($response -ne "y") {
        Write-Host "Migration cancelled"
        exit 0
    }
    Write-Host "Removing existing destination..." -ForegroundColor Yellow
    Remove-Item -Path $DestPath -Recurse -Force
}

# Create destination parent directory
$destParent = Split-Path -Parent $DestPath
if (-not (Test-Path $destParent)) {
    Write-Host "Creating destination parent: $destParent" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $destParent -Force | Out-Null
}

# Move directory
Write-Host "Moving Tech_Sources..." -ForegroundColor Green
try {
    Move-Item -Path $SourcePath -Destination $DestPath -Force
    Write-Host "✓ Successfully moved Tech_Sources to psaback" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to move directory: $_" -ForegroundColor Red
    exit 1
}

# Verify move
if (Test-Path $DestPath) {
    Write-Host ""
    Write-Host "Migration complete!" -ForegroundColor Green
    Write-Host "Tech_Sources is now at: $DestPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Update psaback code to reference: $DestPath" -ForegroundColor White
    Write-Host "2. Update any configuration files (.env, etc.)" -ForegroundColor White
    Write-Host "3. Restart the watcher service" -ForegroundColor White
} else {
    Write-Host "ERROR: Migration may have failed - destination not found" -ForegroundColor Red
    exit 1
}

