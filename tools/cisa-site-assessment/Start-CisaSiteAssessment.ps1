# Start only the CISA Site Assessment Next dev server (:3001). Full toolbox: run pnpm dev from tools/dependency-analysis.
$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
$tools = Split-Path $here -Parent
$repoRoot = Split-Path $tools -Parent
$dep = Join-Path $repoRoot "tools\dependency-analysis"
if (-not (Test-Path -LiteralPath $dep)) {
    Write-Error "Expected PSA Toolbox at $repoRoot (tools\dependency-analysis missing)."
}
Set-Location -LiteralPath $dep
pnpm --filter psa-rebuild dev
