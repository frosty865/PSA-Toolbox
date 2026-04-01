# Package the Asset Dependency Tool into a standalone ADT folder (e.g. C:\ADT).
# Run from asset-dependency-tool repo root. Requires: build:web and reporter.exe already built.
# Usage: .\scripts\package-adt.ps1 [-AdtPath C:\ADT]

param(
  [string]$AdtPath = $env:ADT_PACKAGE_PATH
)
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $AdtPath) {
  $AdtPath = "C:\ADT"
  Write-Host "Using default ADT path: $AdtPath (set ADT_PACKAGE_PATH or -AdtPath to override)"
}

# Create layout
$appDir = Join-Path $AdtPath "app"
$resDir = Join-Path $AdtPath "resources"
$dataDir = Join-Path $AdtPath "data"
foreach ($d in $AdtPath, $appDir, $resDir, $dataDir) {
  New-Item -ItemType Directory -Force -Path $d | Out-Null
}

# Web app
$webDir = Join-Path $RepoRoot "apps\web"
$nextDir = Join-Path $webDir ".next"
if (-not (Test-Path $nextDir)) {
  Write-Error "Web build not found. Run: pnpm run build:web"
}
Copy-Item -Path (Join-Path $webDir ".next") -Destination (Join-Path $appDir ".next") -Recurse -Force
Copy-Item -Path (Join-Path $webDir "public") -Destination (Join-Path $appDir "public") -Recurse -Force
Copy-Item -Path (Join-Path $webDir "package.json") -Destination (Join-Path $appDir "package.json") -Force

# Reporter and resources
$reporterExe = Join-Path $RepoRoot "apps\reporter\dist\reporter.exe"
if (Test-Path $reporterExe) {
  Copy-Item -Path $reporterExe -Destination (Join-Path $resDir "reporter.exe") -Force
} else {
  Write-Warning "reporter.exe not found. Run apps\reporter\build.ps1 and re-run this script."
}
$templateSrc = Join-Path $RepoRoot "assets\templates\Asset Dependency Assessment Report_BLANK.v2backup.docx"
if (Test-Path $templateSrc) {
  Copy-Item -Path $templateSrc -Destination $resDir -Force
}
$vofcSrc = Join-Path $RepoRoot "apps\web\assets\data\VOFC_Library.xlsx"
if (Test-Path $vofcSrc) {
  Copy-Item -Path $vofcSrc -Destination (Join-Path $resDir "VOFC_Library.xlsx") -Force
}

# Launchers and docs (copy from ADT if present, else create minimal)
$adtReadme = Join-Path $AdtPath "README.md"
if (-not (Test-Path $adtReadme)) {
  Write-Host "Copy Start-ADT.ps1, Start-ADT.bat, README.md, DEPLOYMENT.md into $AdtPath if not already there."
}

Write-Host "Package layout created at: $AdtPath"
Write-Host "Next: cd $appDir ; npm install --production"
Write-Host "Then run Start-ADT.ps1 or Start-ADT.bat from $AdtPath"
