# Health check script for Pipeline Watcher (Windows)
# Returns 0 if watcher is running, 1 if not

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$watcherDir = Split-Path -Parent $scriptDir
$pidFile = Join-Path $watcherDir "watcher.pid"

if (-not (Test-Path $pidFile)) {
    Write-Host "ERROR: Watcher PID file not found" -ForegroundColor Red
    exit 1
}

$pid = Get-Content $pidFile
$process = Get-Process -Id $pid -ErrorAction SilentlyContinue

if (-not $process) {
    Write-Host "ERROR: Watcher process not running (stale PID: $pid)" -ForegroundColor Red
    exit 1
}

# Check if process is actually the watcher
$cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $pid").CommandLine
if ($cmdLine -notmatch "pipeline_watcher\.py") {
    Write-Host "ERROR: PID $pid is not the watcher process" -ForegroundColor Red
    exit 1
}

Write-Host "OK: Watcher is running (PID: $pid)" -ForegroundColor Green
exit 0

