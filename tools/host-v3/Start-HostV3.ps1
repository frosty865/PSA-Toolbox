#Requires -Version 5.1
<#
  Dev server for Host V3 (Vite on 127.0.0.1:3001).
  Run once: pnpm install
#>
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Test-Path (Join-Path $PSScriptRoot "node_modules"))) {
  Write-Host "Installing Host V3 dependencies..."
  pnpm install
}
pnpm run dev
