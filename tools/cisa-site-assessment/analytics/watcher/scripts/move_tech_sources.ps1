# Simple script to move Tech_Sources directory
# Run as Administrator

$source = "D:\PSA_System\Tech_Sources"
$dest = "D:\PSA_System\psa_rebuild\psaback\Tech_Sources"

if (Test-Path $source) {
    if (Test-Path $dest) {
        Write-Host "Destination already exists. Remove it first?" -ForegroundColor Yellow
        $response = Read-Host "Remove and move? (y/n)"
        if ($response -eq "y") {
            Remove-Item -Path $dest -Recurse -Force
        } else {
            Write-Host "Cancelled"
            exit 0
        }
    }
    
    $destParent = Split-Path -Parent $dest
    if (-not (Test-Path $destParent)) {
        New-Item -ItemType Directory -Path $destParent -Force | Out-Null
    }
    
    Write-Host "Moving Tech_Sources..." -ForegroundColor Green
    Move-Item -Path $source -Destination $dest -Force
    Write-Host "Moved to: $dest" -ForegroundColor Green
} else {
    Write-Host "Source not found: $source" -ForegroundColor Yellow
    if (Test-Path $dest) {
        Write-Host "Tech_Sources already at: $dest" -ForegroundColor Green
    }
}
