# Start the unified toolbox web app from the dependency-analysis workspace.
# This wrapper preserves the launcher manifest's historical script path.
$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
$startScript = Join-Path $here "scripts\dev\start.ps1"

if (-not (Test-Path -LiteralPath $startScript)) {
    Write-Error "Expected start script at $startScript."
}

& $startScript
