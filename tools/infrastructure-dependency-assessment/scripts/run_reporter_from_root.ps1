# Run the DOCX reporter from repo root. Delegates to tools/export_sample.ps1.
# Usage: from asset-dependency-tool, run: .\scripts\run_reporter_from_root.ps1
$root = $PSScriptRoot | Split-Path -Parent
& (Join-Path $root "tools\export_sample.ps1")
exit $LASTEXITCODE
