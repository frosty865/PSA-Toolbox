# Restore Next.js CLI + get npm run build working under Node 20 LTS
# Run this script AFTER switching to Node 20 via nvm

Write-Host "=== Next.js CLI Restoration Script ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verify Node 20
Write-Host "Step 1: Verifying Node version..." -ForegroundColor Yellow
$nodeVersion = node -v
Write-Host "  Node version: $nodeVersion" -ForegroundColor White
if ($nodeVersion -notmatch "^v20\.") {
    Write-Host "  ERROR: Node 20 is required. Current version: $nodeVersion" -ForegroundColor Red
    Write-Host "  Please run: nvm install 20 && nvm use 20" -ForegroundColor Yellow
    exit 1
}
Write-Host "  ✓ Node 20 detected" -ForegroundColor Green
Write-Host ""

# Step 2: Navigate to repo
Write-Host "Step 2: Navigating to repo..." -ForegroundColor Yellow
# Use PSA_SYSTEM_ROOT or default to PSA_System location
$PSASystemRoot = $env:PSA_SYSTEM_ROOT
if ([string]::IsNullOrEmpty($PSASystemRoot)) {
    $PSASystemRoot = "D:\PSA_System"
}
$repoPath = "$PSASystemRoot\psa_rebuild"
if (-not (Test-Path $repoPath)) {
    Write-Host "  ERROR: Repo path not found: $repoPath" -ForegroundColor Red
    exit 1
}
Set-Location $repoPath
Write-Host "  ✓ In repo: $(Get-Location)" -ForegroundColor Green
Write-Host ""

# Step 3: Hard clean
Write-Host "Step 3: Cleaning node_modules and package-lock.json..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "  Removing node_modules..." -ForegroundColor White
    Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
    Write-Host "  ✓ node_modules removed" -ForegroundColor Green
} else {
    Write-Host "  node_modules not found (already clean)" -ForegroundColor Gray
}

if (Test-Path "package-lock.json") {
    Write-Host "  Removing package-lock.json..." -ForegroundColor White
    Remove-Item -Force "package-lock.json" -ErrorAction SilentlyContinue
    Write-Host "  ✓ package-lock.json removed" -ForegroundColor Green
} else {
    Write-Host "  package-lock.json not found (already clean)" -ForegroundColor Gray
}
Write-Host ""

# Step 4: Clean npm cache
Write-Host "Step 4: Cleaning npm cache..." -ForegroundColor Yellow
npm cache verify
npm cache clean --force
Write-Host "  ✓ npm cache cleaned" -ForegroundColor Green
Write-Host ""

# Step 5: Reinstall dependencies
Write-Host "Step 5: Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: npm install failed" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Dependencies installed" -ForegroundColor Green
Write-Host ""

# Step 6: Verify Next.js installation
Write-Host "Step 6: Verifying Next.js installation..." -ForegroundColor Yellow
$nextCmdPath = ".\node_modules\.bin\next.cmd"
if (Test-Path $nextCmdPath) {
    Write-Host "  ✓ next.cmd exists: $nextCmdPath" -ForegroundColor Green
} else {
    Write-Host "  ERROR: next.cmd not found!" -ForegroundColor Red
    exit 1
}

$nextVersion = node -p "require('next/package.json').version"
Write-Host "  ✓ Next.js version: $nextVersion" -ForegroundColor Green

$npmLs = npm ls next 2>&1
if ($npmLs -match "invalid") {
    Write-Host "  ERROR: Next.js installation is invalid!" -ForegroundColor Red
    Write-Host "  Output: $npmLs" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Next.js installation valid" -ForegroundColor Green
Write-Host ""

# Step 7: Verify hardening
Write-Host "Step 7: Verifying hardening measures..." -ForegroundColor Yellow
if (Test-Path ".\.nvmrc") {
    $nvmrcContent = Get-Content ".\.nvmrc" -Raw
    Write-Host "  ✓ .nvmrc exists: $nvmrcContent" -ForegroundColor Green
} else {
    Write-Host "  Creating .nvmrc..." -ForegroundColor White
    Set-Content -Path ".\.nvmrc" -Value "20" -Encoding ASCII
    Write-Host "  ✓ .nvmrc created" -ForegroundColor Green
}

$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
if ($packageJson.engines -and $packageJson.engines.node) {
    Write-Host "  ✓ engines.node: $($packageJson.engines.node)" -ForegroundColor Green
} else {
    Write-Host "  Updating package.json engines..." -ForegroundColor White
    $packageJson.engines = @{ node = ">=20 <21" }
    $packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json"
    Write-Host '  ✓ engines.node set to ">=20 <21"' -ForegroundColor Green
}

$engineStrict = npm config get engine-strict
if ($engineStrict -eq "true") {
    Write-Host "  ✓ engine-strict: true" -ForegroundColor Green
} else {
    Write-Host "  Setting engine-strict to true..." -ForegroundColor White
    npm config set engine-strict true
    Write-Host "  ✓ engine-strict set to true" -ForegroundColor Green
}
Write-Host ""

# Step 8: Test build
Write-Host "Step 8: Testing build (may have TS/ESLint errors, but should reach Next compilation)..." -ForegroundColor Yellow
Write-Host "  Running: npm run build" -ForegroundColor White
npm run build 2>&1 | Select-Object -First 50
Write-Host ""

Write-Host "=== Script Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "If build succeeded or reached Next.js compilation, the CLI is restored!" -ForegroundColor Green
Write-Host "If you see 'next is not recognized', check:" -ForegroundColor Yellow
$currentPath = Get-Location
Write-Host "  1. Are you in the correct directory? (Current: $currentPath)" -ForegroundColor White
Write-Host "  2. Does node_modules\.bin\next.cmd exist?" -ForegroundColor White
Write-Host '  3. Try: Test-Path .\node_modules\.bin\next.cmd' -ForegroundColor White
