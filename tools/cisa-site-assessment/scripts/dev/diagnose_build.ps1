# Build diagnostics script for PSA rebuild
# Captures all build output to timestamped log file

$ErrorActionPreference = "Stop"

# Create reports directory if missing
$reportsDir = Join-Path (Get-Location) "analytics\reports\build"
if (!(Test-Path $reportsDir)) {
    New-Item -ItemType Directory -Force -Path $reportsDir | Out-Null
}

# Generate timestamp
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$logFile = Join-Path $reportsDir "build_$ts.log"

Write-Host "=== PSA Build Diagnostics ===" | Tee-Object -FilePath $logFile -Append
Write-Host "Log file: $logFile" | Tee-Object -FilePath $logFile -Append
Write-Host "" | Tee-Object -FilePath $logFile -Append

# Print versions
Write-Host "=== Node/NPM Versions ===" | Tee-Object -FilePath $logFile -Append
node --version 2>&1 | Tee-Object -FilePath $logFile -Append
npm --version 2>&1 | Tee-Object -FilePath $logFile -Append
Write-Host "" | Tee-Object -FilePath $logFile -Append

# Delete Next build cache
Write-Host "=== Cleaning .next directory ===" | Tee-Object -FilePath $logFile -Append
if (Test-Path .next) {
    Remove-Item -Recurse -Force .next
    Write-Host ".next directory removed" | Tee-Object -FilePath $logFile -Append
} else {
    Write-Host ".next directory does not exist" | Tee-Object -FilePath $logFile -Append
}
Write-Host "" | Tee-Object -FilePath $logFile -Append

# Run doctrine:check
Write-Host "=== Running doctrine:check ===" | Tee-Object -FilePath $logFile -Append
$exitCode = 0
npm run doctrine:check 2>&1 | Tee-Object -FilePath $logFile -Append
if ($LASTEXITCODE -ne 0) {
    $exitCode = $LASTEXITCODE
    Write-Host "FAILED: doctrine:check exited with code $exitCode" | Tee-Object -FilePath $logFile -Append
    exit $exitCode
}
Write-Host "" | Tee-Object -FilePath $logFile -Append

# Run lint (restricted to source directories)
Write-Host "=== Running lint (max-warnings=0) ===" | Tee-Object -FilePath $logFile -Append
npm run lint 2>&1 | Tee-Object -FilePath $logFile -Append
if ($LASTEXITCODE -ne 0) {
    $exitCode = $LASTEXITCODE
    Write-Host "FAILED: lint exited with code $exitCode" | Tee-Object -FilePath $logFile -Append
    exit $exitCode
}
Write-Host "" | Tee-Object -FilePath $logFile -Append

# Run typecheck
Write-Host "=== Running typecheck ===" | Tee-Object -FilePath $logFile -Append
npm run typecheck 2>&1 | Tee-Object -FilePath $logFile -Append
if ($LASTEXITCODE -ne 0) {
    $exitCode = $LASTEXITCODE
    Write-Host "FAILED: typecheck exited with code $exitCode" | Tee-Object -FilePath $logFile -Append
    exit $exitCode
}
Write-Host "" | Tee-Object -FilePath $logFile -Append

# Run build
Write-Host "=== Running build ===" | Tee-Object -FilePath $logFile -Append
npm run build 2>&1 | Tee-Object -FilePath $logFile -Append
if ($LASTEXITCODE -ne 0) {
    $exitCode = $LASTEXITCODE
    Write-Host "FAILED: build exited with code $exitCode" | Tee-Object -FilePath $logFile -Append
    exit $exitCode
}
Write-Host "" | Tee-Object -FilePath $logFile -Append

Write-Host "=== SUCCESS: All checks passed ===" | Tee-Object -FilePath $logFile -Append
Write-Host "Log saved to: $logFile" | Tee-Object -FilePath $logFile -Append
exit 0
