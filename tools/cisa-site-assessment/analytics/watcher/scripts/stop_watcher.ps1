# Stop Pipeline Watcher (Windows)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$watcherDir = Split-Path -Parent $scriptDir
$pidFile = Join-Path $watcherDir "watcher.pid"

if (-not (Test-Path $pidFile)) {
    Write-Host "Watcher is not running (no PID file found)" -ForegroundColor Yellow
    exit 0
}

$pid = Get-Content $pidFile
$process = Get-Process -Id $pid -ErrorAction SilentlyContinue

if (-not $process) {
    Write-Host "Watcher is not running (stale PID file)" -ForegroundColor Yellow
    Remove-Item $pidFile
    exit 0
}

Write-Host "Stopping Pipeline Watcher (PID: $pid)..." -ForegroundColor Yellow

# Try graceful stop
Stop-Process -Id $pid -ErrorAction SilentlyContinue

# Wait for process to stop
$timeout = 30
$elapsed = 0
while ($elapsed -lt $timeout) {
    $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if (-not $process) {
        Write-Host "Watcher stopped successfully" -ForegroundColor Green
        Remove-Item $pidFile
        exit 0
    }
    Start-Sleep -Seconds 1
    $elapsed++
}

# Force kill if still running
$process = Get-Process -Id $pid -ErrorAction SilentlyContinue
if ($process) {
    Write-Host "Force killing watcher..." -ForegroundColor Yellow
    Stop-Process -Id $pid -Force
    Remove-Item $pidFile
    Write-Host "Watcher force stopped" -ForegroundColor Green
}

