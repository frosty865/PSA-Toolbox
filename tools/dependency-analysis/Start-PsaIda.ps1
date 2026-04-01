#Requires -Version 5.1
<#
  Start the PSA Infrastructure Dependency Assessment (local Next.js production server).
  Prerequisites (run once): pnpm install ; pnpm run build:web
  Binds to loopback only. Sets ADT_ROOT so export/DOCX paths resolve to this tree.
#>
$ErrorActionPreference = "Stop"
$ToolRoot = $PSScriptRoot
$env:ADT_ROOT = $ToolRoot
$env:ADT_APP_ROOT = $ToolRoot
$env:NODE_ENV = "production"
if (-not $env:PORT) { $env:PORT = "3000" }

Set-Location $ToolRoot
if (-not (Test-Path (Join-Path $ToolRoot "apps\web\.next"))) {
  Write-Error "No production build found. From this folder run: pnpm install ; pnpm run build:web"
}

Write-Host "PSA IDA — http://127.0.0.1:$($env:PORT)/  (ADT_ROOT=$ToolRoot)"
pnpm --filter web exec -- next start --hostname 127.0.0.1 --port $env:PORT
