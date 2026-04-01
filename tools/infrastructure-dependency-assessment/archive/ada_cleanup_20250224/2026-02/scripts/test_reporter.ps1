$ErrorActionPreference = "Stop"
$env:WORK_DIR = "d:\ADA\test_work"
$env:TEMPLATE_PATH = "d:\ADA\asset-dependency-tool\assets\templates\Asset Dependency Assessment Report_BLANK.docx"

Write-Host "Creating work directory..."
mkdir -Force $env:WORK_DIR | Out-Null

Write-Host "Running reporter..."
$input = Get-Content "d:\ADA\test_report_input.json" -Raw
$output = $input | & "d:\ADA\asset-dependency-tool\apps\reporter\dist\reporter.exe" 2>&1

Write-Host "Reporter output:"
Write-Host $output
Write-Host "`nExit code: $LASTEXITCODE"

Write-Host "`nChecking for output.docx..."
$docxPath = Join-Path $env:WORK_DIR "output.docx"
if (Test-Path $docxPath) {
    $size = (Get-Item $docxPath).Length
    Write-Host "SUCCESS: output.docx created ($size bytes)"
} else {
    Write-Host "ERROR: output.docx not found at $docxPath"
    Write-Host "`nContents of work directory:"
    Get-ChildItem -Recurse $env:WORK_DIR
}
