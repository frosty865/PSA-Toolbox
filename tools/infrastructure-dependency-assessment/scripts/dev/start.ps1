# Start the web app (Windows-friendly)
# Sets ADA_WORK_ROOT and ADA_TEMPLATE_PATH for the process

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

$templateName = "Asset Dependency Assessment Report_BLANK.docx"
$templatePath = Join-Path $RepoRoot "assets\templates\$templateName"

$env:ADA_WORK_ROOT = $RepoRoot
$env:ADA_TEMPLATE_PATH = $templatePath

# Prefer pnpm; fall back to npx pnpm
Set-Location $RepoRoot
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    pnpm --filter web dev
} else {
    npx pnpm --filter web dev
}
