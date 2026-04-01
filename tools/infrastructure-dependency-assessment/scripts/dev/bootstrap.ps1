# One-time environment setup for asset-dependency-tool (Windows-friendly)
# Installs pnpm deps, creates data dirs, validates template and Python

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

# Prefer pnpm; fall back to npx pnpm so users don't need global pnpm
Set-Location $RepoRoot
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    pnpm install
} else {
    Write-Host "pnpm not in PATH; using npx pnpm."
    npx pnpm install
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Create data/temp and data/exports if missing
$dirs = @("data\temp", "data\exports")
foreach ($d in $dirs) {
    $path = Join-Path $RepoRoot $d
    if (-not (Test-Path $path)) {
        New-Item -ItemType Directory -Path $path -Force | Out-Null
        Write-Host "Created $d"
    }
}

# Validate template file exists
$templateName = "Asset Dependency Assessment Report_BLANK.docx"
$templatePath = Join-Path $RepoRoot "assets\templates\$templateName"
if (-not (Test-Path $templatePath -PathType Leaf)) {
    Write-Error "Template not found: $templatePath. Add the file to assets/templates/ and re-run bootstrap."
    exit 1
}
Write-Host "Template OK: assets\templates\$templateName"

# Validate Python available or warn (reporter needs it for export)
$pythonCmd = $null
foreach ($name in @("python", "python3", "py")) {
    if (Get-Command $name -ErrorAction SilentlyContinue) {
        $pythonCmd = $name
        break
    }
}
if (-not $pythonCmd) {
    Write-Host ""
    Write-Host "WARNING: Python not found in PATH. Report export (DOCX) requires Python and apps/reporter. Install Python and add to PATH, or export will fail." -ForegroundColor Yellow
} else {
    $ver = & $pythonCmd --version 2>&1
    Write-Host "Python OK: $ver"
}

Write-Host ""
Write-Host "Bootstrap done. Run: scripts\dev\start.ps1" -ForegroundColor Green
