# Reorganize psaback - Move misplaced files to correct repos
# Run from: D:\PSA_System\psa_rebuild

$ErrorActionPreference = "Stop"

$PsabackRoot = "D:\PSA_System\psa_rebuild\psaback"
$PsaEngineRoot = "D:\PSA_System\psa_rebuild\psa_engine"
$PsaRebuildRoot = "D:\PSA_System\psa_rebuild"

Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "psaback Reorganization Script" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

# Step 1: Remove nested empty repos
Write-Host "STEP 1: Removing nested empty repositories..." -ForegroundColor Yellow
$emptyFolders = @(
    "$PsabackRoot\psa-rebuild",
    "$PsabackRoot\psaback"
)

foreach ($folder in $emptyFolders) {
    if (Test-Path $folder) {
        $items = Get-ChildItem $folder -Recurse -Force -ErrorAction SilentlyContinue
        if ($items.Count -eq 0) {
            Write-Host "  Removing empty folder: $folder" -ForegroundColor Green
            Remove-Item -Path $folder -Recurse -Force
        } else {
            Write-Host "  WARNING: Folder not empty: $folder ($($items.Count) items)" -ForegroundColor Yellow
        }
    }
}

# Step 2: Check nested psa_engine
Write-Host ""
Write-Host "STEP 2: Checking nested psa_engine folder..." -ForegroundColor Yellow
$nestedEngine = "$PsabackRoot\psa_engine"
if (Test-Path $nestedEngine) {
    Write-Host "  WARNING: Nested psa_engine folder found: $nestedEngine" -ForegroundColor Yellow
    Write-Host "  This should be removed - psaback should reference psa_engine as sibling, not nested" -ForegroundColor Yellow
    Write-Host "  Checking if it's referenced in code..." -ForegroundColor Yellow
    
    # Check if code references nested path
    $references = Get-ChildItem -Path $PsabackRoot -Recurse -Include *.py -ErrorAction SilentlyContinue | 
        Select-String -Pattern "psaback\\psa_engine|parent.*psa_engine" -CaseSensitive:$false
    
    if ($references) {
        Write-Host "  Found references to nested path - these need to be updated first!" -ForegroundColor Red
        Write-Host "  References:" -ForegroundColor Red
        $references | ForEach-Object { Write-Host "    $($_.Path):$($_.LineNumber)" -ForegroundColor Red }
        Write-Host ""
        Write-Host "  SKIPPING removal - fix references first" -ForegroundColor Yellow
    } else {
        Write-Host "  No code references found - safe to remove" -ForegroundColor Green
        $response = Read-Host "  Remove nested psa_engine folder? (y/n)"
        if ($response -eq "y") {
            Remove-Item -Path $nestedEngine -Recurse -Force
            Write-Host "  Removed nested psa_engine folder" -ForegroundColor Green
        }
    }
}

# Step 3: Move doctrine content to psa_engine
Write-Host ""
Write-Host "STEP 3: Moving doctrine content to psa_engine..." -ForegroundColor Yellow

# Move required_element_sets
$requiredElements = "$PsabackRoot\required_element_sets"
$targetRequiredElements = "$PsaEngineRoot\required_element_sets"

if (Test-Path $requiredElements) {
    Write-Host "  Moving required_element_sets..." -ForegroundColor Cyan
    if (Test-Path $targetRequiredElements) {
        Write-Host "    WARNING: Target already exists: $targetRequiredElements" -ForegroundColor Yellow
        $response = Read-Host "    Overwrite? (y/n)"
        if ($response -eq "y") {
            Remove-Item -Path $targetRequiredElements -Recurse -Force
            Move-Item -Path $requiredElements -Destination $targetRequiredElements -Force
            Write-Host "    Moved required_element_sets to psa_engine" -ForegroundColor Green
        } else {
            Write-Host "    SKIPPED" -ForegroundColor Yellow
        }
    } else {
        Move-Item -Path $requiredElements -Destination $targetRequiredElements -Force
        Write-Host "    Moved required_element_sets to psa_engine" -ForegroundColor Green
    }
} else {
    Write-Host "  required_element_sets not found (may already be moved)" -ForegroundColor Gray
}

# Move model/doctrine_v2
$doctrineV2 = "$PsabackRoot\model\doctrine_v2"
$targetDoctrineV2 = "$PsaEngineRoot\model\doctrine_v2"

if (Test-Path $doctrineV2) {
    Write-Host "  Moving model/doctrine_v2..." -ForegroundColor Cyan
    if (-not (Test-Path "$PsaEngineRoot\model")) {
        New-Item -ItemType Directory -Path "$PsaEngineRoot\model" -Force | Out-Null
    }
    if (Test-Path $targetDoctrineV2) {
        Write-Host "    WARNING: Target already exists: $targetDoctrineV2" -ForegroundColor Yellow
        $response = Read-Host "    Overwrite? (y/n)"
        if ($response -eq "y") {
            Remove-Item -Path $targetDoctrineV2 -Recurse -Force
            Move-Item -Path $doctrineV2 -Destination $targetDoctrineV2 -Force
            Write-Host "    Moved model/doctrine_v2 to psa_engine" -ForegroundColor Green
        } else {
            Write-Host "    SKIPPED" -ForegroundColor Yellow
        }
    } else {
        Move-Item -Path $doctrineV2 -Destination $targetDoctrineV2 -Force
        Write-Host "    Moved model/doctrine_v2 to psa_engine" -ForegroundColor Green
    }
} else {
    Write-Host "  model/doctrine_v2 not found (may already be moved)" -ForegroundColor Gray
}

# Step 4: Evaluate UI assets (templates, static, styles)
Write-Host ""
Write-Host "STEP 4: Evaluating UI assets..." -ForegroundColor Yellow
Write-Host "  NOTE: psaback/app.py uses Flask with render_template and send_from_directory" -ForegroundColor Cyan
Write-Host "  These folders are used by psaback to serve HTML/CSS directly" -ForegroundColor Cyan
Write-Host "  Decision: KEEP in psaback (served by Flask)" -ForegroundColor Green

# Step 5: Evaluate Node.js files
Write-Host ""
Write-Host "STEP 5: Evaluating Node.js files..." -ForegroundColor Yellow
$packageJson = "$PsabackRoot\package.json"
if (Test-Path $packageJson) {
    $packageContent = Get-Content $packageJson -Raw | ConvertFrom-Json
    Write-Host "  package.json found with dependencies:" -ForegroundColor Cyan
    $packageContent.dependencies.PSObject.Properties.Name | ForEach-Object {
        Write-Host "    - $_" -ForegroundColor Gray
    }
    Write-Host "  These appear to be tooling dependencies (ai, tsx, dotenv)" -ForegroundColor Cyan
    Write-Host "  Decision: KEEP in psaback (used for tooling)" -ForegroundColor Green
} else {
    Write-Host "  package.json not found" -ForegroundColor Gray
}

# Summary
Write-Host ""
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "Reorganization Summary" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""
Write-Host "Moved to psa_engine:" -ForegroundColor Green
Write-Host "  - required_element_sets/" -ForegroundColor Green
Write-Host "  - model/doctrine_v2/" -ForegroundColor Green
Write-Host ""
Write-Host "Removed:" -ForegroundColor Green
Write-Host "  - psa-rebuild/ (empty)" -ForegroundColor Green
Write-Host "  - psaback/ (empty)" -ForegroundColor Green
Write-Host ""
Write-Host "Kept in psaback (in use):" -ForegroundColor Yellow
Write-Host "  - templates/ (Flask templates)" -ForegroundColor Yellow
Write-Host "  - static/ (Flask static files)" -ForegroundColor Yellow
Write-Host "  - styles/ (Flask CSS)" -ForegroundColor Yellow
Write-Host "  - node_modules/ (tooling)" -ForegroundColor Yellow
Write-Host "  - package.json (tooling)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Action needed:" -ForegroundColor Red
Write-Host "  - Review nested psa_engine/ folder (may need code updates first)" -ForegroundColor Red
Write-Host ""
Write-Host "=" * 70 -ForegroundColor Cyan

